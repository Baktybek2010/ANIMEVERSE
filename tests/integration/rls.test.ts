import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient, anonClient, cleanupTestUsers, createTestAnime, createTestUser, deleteTestAnime, hasLocalSupabase, RUN_ID, type TestUser,
} from "../helpers/supabase";

/**
 * Проверка безопасности на уровне базы данных: запросы идут напрямую в Supabase API
 * с ключами обычных пользователей — так же, как это сделал бы злоумышленник, минуя интерфейс.
 */
describe.skipIf(!hasLocalSupabase)("RLS и права доступа", () => {
  let alice: TestUser;
  let bob: TestUser;
  let moderator: TestUser;
  let admin: TestUser;
  let superAdmin: TestUser;
  let anime: Awaited<ReturnType<typeof createTestAnime>>;
  let draft: Awaited<ReturnType<typeof createTestAnime>>;

  beforeAll(async () => {
    [alice, bob, moderator, admin, superAdmin] = await Promise.all([
      createTestUser("user", "alice"),
      createTestUser("user", "bob"),
      createTestUser("moderator", "mod"),
      createTestUser("admin", "adm"),
      createTestUser("super_admin", "root"),
    ]);
    anime = await createTestAnime({ published: true });
    draft = await createTestAnime({ published: false });
  });

  afterAll(async () => {
    await deleteTestAnime(anime.id);
    await deleteTestAnime(draft.id);
    await cleanupTestUsers();
  });

  describe("профили", () => {
    it("при регистрации создаётся профиль с ролью user и приветственное уведомление", async () => {
      const { data } = await alice.client.from("profiles").select("username, role, is_banned, locale").eq("id", alice.id).single();
      expect(data).toEqual({ username: alice.username, role: "user", is_banned: false, locale: "ru" });
      const { data: notifications } = await alice.client.from("notifications").select("type");
      expect(notifications?.map((item) => item.type)).toContain("welcome");
    });

    it("пользователь не видит чужие профили, гость не видит никаких", async () => {
      const { data } = await alice.client.from("profiles").select("id");
      expect(data?.map((row) => row.id)).toEqual([alice.id]);
      const guest = await anonClient().from("profiles").select("id");
      expect(guest.data ?? []).toEqual([]);
    });

    it("пользователь может менять свои данные", async () => {
      const { error } = await alice.client.from("profiles").update({ display_name: "Alice", bio: "hi" }).eq("id", alice.id);
      expect(error).toBeNull();
    });

    it.each([
      ["role", { role: "super_admin" }],
      ["is_banned", { is_banned: true }],
      ["email", { email: "hacker@example.com" }],
    ])("пользователь не может изменить защищённое поле %s", async (_field, patch) => {
      const { error } = await alice.client.from("profiles").update(patch).eq("id", alice.id);
      expect(error?.code).toBe("42501");
      const { data } = await adminClient().from("profiles").select("role, is_banned, email").eq("id", alice.id).single();
      expect(data).toMatchObject({ role: "user", is_banned: false, email: alice.email });
    });

    it("пользователь не может изменить чужой профиль", async () => {
      await alice.client.from("profiles").update({ display_name: "hacked" }).eq("id", bob.id);
      const { data } = await adminClient().from("profiles").select("display_name").eq("id", bob.id).single();
      expect(data?.display_name).not.toBe("hacked");
    });

    it("персонал видит профили пользователей", async () => {
      const { data } = await moderator.client.from("profiles").select("id").in("id", [alice.id, bob.id]);
      expect(data).toHaveLength(2);
    });

    it("нельзя занять чужое имя пользователя в другом регистре", async () => {
      const { error } = await alice.client.from("profiles").update({ username: bob.username.toUpperCase() }).eq("id", alice.id);
      expect(error?.code).toBe("23505");
    });
  });

  describe("управление ролями (SQL-функция admin_set_user_role)", () => {
    const setRole = (actor: TestUser, target: TestUser, role: string) => actor.client.rpc("admin_set_user_role", { p_user: target.id, p_role: role });
    const roleOf = async (user: TestUser) => (await adminClient().from("profiles").select("role").eq("id", user.id).single()).data?.role;

    it("обычный пользователь и модератор не могут менять роли", async () => {
      expect((await setRole(alice, alice, "admin")).error?.message).toContain("forbidden");
      expect((await setRole(alice, bob, "moderator")).error?.message).toContain("forbidden");
      expect((await setRole(moderator, alice, "moderator")).error?.message).toContain("forbidden");
      expect(await roleOf(alice)).toBe("user");
    });

    it("администратор не может менять собственную роль", async () => {
      expect((await setRole(admin, admin, "super_admin")).error?.message).toContain("cannot_change_own_role");
      expect(await roleOf(admin)).toBe("admin");
    });

    it("администратор не может назначить роль своего уровня или выше", async () => {
      expect((await setRole(admin, bob, "admin")).error?.message).toContain("insufficient_privileges");
      expect((await setRole(admin, bob, "super_admin")).error?.message).toContain("insufficient_privileges");
      expect(await roleOf(bob)).toBe("user");
    });

    it("администратор не может изменить супер-администратора", async () => {
      expect((await setRole(admin, superAdmin, "user")).error?.message).toContain("insufficient_privileges");
      expect(await roleOf(superAdmin)).toBe("super_admin");
    });

    it("администратор назначает и снимает модератора; действие попадает в журнал", async () => {
      expect((await setRole(admin, bob, "moderator")).error).toBeNull();
      expect(await roleOf(bob)).toBe("moderator");
      const { data: logs } = await admin.client.from("admin_logs").select("action, details").eq("entity_id", bob.id).eq("action", "user.role_change");
      expect(logs?.[0]?.details).toMatchObject({ from: "user", to: "moderator" });
      expect((await setRole(admin, bob, "user")).error).toBeNull();
      expect(await roleOf(bob)).toBe("user");
    });

    it("супер-администратор может назначить администратора", async () => {
      expect((await setRole(superAdmin, bob, "admin")).error).toBeNull();
      expect(await roleOf(bob)).toBe("admin");
      expect((await setRole(superAdmin, bob, "user")).error).toBeNull();
    });

    it("отклоняет несуществующую роль", async () => {
      expect((await setRole(superAdmin, bob, "god")).error?.message).toContain("invalid_role");
    });
  });

  describe("каталог", () => {
    it("гость видит опубликованное аниме и не видит черновики", async () => {
      const { data } = await anonClient().from("anime").select("id").in("id", [anime.id, draft.id]);
      expect(data?.map((row) => row.id)).toEqual([anime.id]);
      const episodes = await anonClient().from("episodes").select("id").eq("anime_id", draft.id);
      expect(episodes.data).toEqual([]);
    });

    it("модератор видит черновики", async () => {
      const { data } = await moderator.client.from("anime").select("id").eq("id", draft.id);
      expect(data).toHaveLength(1);
    });

    it("гость и обычный пользователь не могут изменять каталог", async () => {
      for (const client of [anonClient(), alice.client]) {
        const insert = await client.from("anime").insert({ slug: `hack-${RUN_ID}`, title_romaji: "Hack" });
        expect(insert.error).not.toBeNull();
        await client.from("anime").update({ title_romaji: "Hacked" }).eq("id", anime.id);
        await client.from("anime").delete().eq("id", anime.id);
        await client.from("episode_sources").insert({ episode_id: anime.freeEpisodeId, kind: "mp4", url: "https://evil.example/x.mp4" });
      }
      const { data } = await adminClient().from("anime").select("title_romaji").eq("id", anime.id).single();
      expect(data?.title_romaji).toContain("Test");
      const { count } = await adminClient().from("episode_sources").select("id", { count: "exact", head: true }).eq("episode_id", anime.freeEpisodeId);
      expect(count).toBe(1);
    });

    it("модератор редактирует, но не удаляет аниме; администратор удаляет", async () => {
      const temp = await createTestAnime({ published: false });
      expect((await moderator.client.from("anime").update({ studio: "Test Studio" }).eq("id", temp.id)).error).toBeNull();
      await moderator.client.from("anime").delete().eq("id", temp.id);
      expect((await adminClient().from("anime").select("id").eq("id", temp.id)).data).toHaveLength(1);
      await admin.client.from("anime").delete().eq("id", temp.id);
      expect((await adminClient().from("anime").select("id").eq("id", temp.id)).data).toHaveLength(0);
    });

    it("поисковая строка и жанры поддерживаются триггерами", async () => {
      const db = adminClient();
      await db.from("anime_translations").upsert({ anime_id: anime.id, locale: "ru", title: "Тестовое Аниме Кириллицей" });
      const { data: genre } = await db.from("genres").select("id, slug").eq("slug", "action").single();
      await db.from("anime_genres").insert({ anime_id: anime.id, genre_id: genre!.id });
      const { data } = await db.from("anime").select("search_text, genre_slugs").eq("id", anime.id).single();
      expect(data?.search_text).toContain("тестовое аниме кириллицей");
      expect(data?.genre_slugs).toEqual(["action"]);
      const found = await anonClient().from("anime").select("id").ilike("search_text", "%аниме кириллицей%").eq("id", anime.id);
      expect(found.data).toHaveLength(1);
    });
  });

  describe("избранное, список и история", () => {
    it("пользователь управляет только своими списками", async () => {
      expect((await alice.client.from("favorites").insert({ user_id: alice.id, anime_id: anime.id })).error).toBeNull();
      expect((await alice.client.from("favorites").insert({ user_id: bob.id, anime_id: anime.id })).error?.code).toBe("42501");
      const { data } = await bob.client.from("favorites").select("anime_id");
      expect(data).toEqual([]);
      await bob.client.from("favorites").delete().eq("user_id", alice.id);
      expect((await alice.client.from("favorites").select("anime_id")).data).toHaveLength(1);
    });

    it("гость не может добавлять в избранное", async () => {
      const { error } = await anonClient().from("favorites").insert({ user_id: alice.id, anime_id: anime.id });
      expect(error).not.toBeNull();
    });

    it("история сохраняется для бесплатной серии; anime_id проставляет триггер", async () => {
      const { error } = await alice.client.from("watch_history").upsert(
        { user_id: alice.id, episode_id: anime.freeEpisodeId, anime_id: "00000000-0000-0000-0000-000000000000", position_seconds: 5000, duration_seconds: 1440 },
        { onConflict: "user_id,episode_id" },
      );
      expect(error).toBeNull();
      const { data } = await alice.client.from("watch_history").select("anime_id, position_seconds").eq("episode_id", anime.freeEpisodeId).single();
      expect(data).toEqual({ anime_id: anime.id, position_seconds: 1440 });
    });

    it("нельзя записать историю для Premium-серии без подписки или за другого пользователя", async () => {
      const row = { anime_id: anime.id, position_seconds: 10, duration_seconds: 100 };
      expect((await alice.client.from("watch_history").insert({ ...row, user_id: alice.id, episode_id: anime.premiumEpisodeId })).error?.code).toBe("42501");
      expect((await alice.client.from("watch_history").insert({ ...row, user_id: bob.id, episode_id: anime.freeEpisodeId })).error?.code).toBe("42501");
    });

    it("«Продолжить просмотр» возвращает следующую серию после досмотренной", async () => {
      await adminClient().from("watch_history").update({ completed: true }).eq("user_id", alice.id).eq("episode_id", anime.freeEpisodeId);
      const { data } = await alice.client.rpc("get_continue_watching", { p_limit: 10 });
      expect(data?.find((row) => row.anime_id === anime.id)?.episode_id).toBe(anime.premiumEpisodeId);
    });
  });

  describe("Premium-доступ к видео", () => {
    const sources = async (client: TestUser["client"], episodeId: string) =>
      (await client.from("episode_sources").select("url").eq("episode_id", episodeId)).data ?? [];

    it("бесплатная серия доступна всем, Premium — никому без подписки", async () => {
      expect(await sources(anonClient(), anime.freeEpisodeId)).toHaveLength(1);
      expect(await sources(alice.client, anime.freeEpisodeId)).toHaveLength(1);
      expect(await sources(anonClient(), anime.premiumEpisodeId)).toEqual([]);
      expect(await sources(alice.client, anime.premiumEpisodeId)).toEqual([]);
      expect((await alice.client.rpc("is_premium")).data).toBe(false);
    });

    it("метаданные Premium-серии видны, скрыты только ссылки на поток", async () => {
      const { data } = await anonClient().from("episodes").select("id, is_premium").eq("id", anime.premiumEpisodeId);
      expect(data).toEqual([{ id: anime.premiumEpisodeId, is_premium: true }]);
    });

    it("пользователь не может выдать себе подписку", async () => {
      const row = { user_id: alice.id, plan_id: "premium_monthly", status: "active" as const, provider: "manual", current_period_end: new Date(Date.now() + 86400_000).toISOString() };
      expect((await alice.client.from("subscriptions").insert(row)).error).not.toBeNull();
      expect((await alice.client.rpc("admin_grant_subscription", { p_user: alice.id, p_plan: "premium_monthly", p_days: 30 })).error?.message).toContain("forbidden");
      expect((await alice.client.from("payments").insert({ user_id: alice.id, provider: "stripe", provider_payment_id: "x", amount_cents: 1, currency: "usd", status: "succeeded" })).error).not.toBeNull();
      expect((await alice.client.rpc("is_premium")).data).toBe(false);
    });

    it("после выдачи подписки администратором Premium-серия открывается, после истечения — закрывается", async () => {
      const grant = await admin.client.rpc("admin_grant_subscription", { p_user: alice.id, p_plan: "premium_monthly", p_days: 30 });
      expect(grant.error).toBeNull();
      expect((await alice.client.rpc("is_premium")).data).toBe(true);
      expect(await sources(alice.client, anime.premiumEpisodeId)).toHaveLength(1);
      expect(await sources(bob.client, anime.premiumEpisodeId)).toEqual([]);

      // Повторная выдача при действующей подписке отклоняется.
      const again = await admin.client.rpc("admin_grant_subscription", { p_user: alice.id, p_plan: "premium_monthly", p_days: 30 });
      expect(again.error?.message).toContain("subscription_already_active");

      // Срок истёк: доступ пропадает сразу, даже до запуска задачи по расписанию.
      await adminClient().from("subscriptions").update({ current_period_start: "2020-01-01T00:00:00Z", current_period_end: "2020-02-01T00:00:00Z" }).eq("id", grant.data as string);
      expect((await alice.client.rpc("is_premium")).data).toBe(false);
      expect(await sources(alice.client, anime.premiumEpisodeId)).toEqual([]);

      // Задача по расписанию переводит подписку в «expired» и уведомляет пользователя.
      const expired = await adminClient().rpc("expire_subscriptions");
      expect(expired.data).toBeGreaterThanOrEqual(1);
      const { data: sub } = await adminClient().from("subscriptions").select("status").eq("id", grant.data as string).single();
      expect(sub?.status).toBe("expired");
      const { data: notes } = await alice.client.from("notifications").select("type");
      expect(notes?.map((note) => note.type)).toEqual(expect.arrayContaining(["premium_granted", "premium_expired"]));
    });

    it("персонал видит источники Premium-серий для проверки контента", async () => {
      expect(await sources(moderator.client, anime.premiumEpisodeId)).toHaveLength(1);
    });
  });

  describe("блокировка", () => {
    it("только администратор может блокировать, и только нижестоящих", async () => {
      expect((await moderator.client.rpc("admin_set_user_ban", { p_user: bob.id, p_banned: true })).error?.message).toContain("forbidden");
      expect((await admin.client.rpc("admin_set_user_ban", { p_user: superAdmin.id, p_banned: true })).error?.message).toContain("insufficient_privileges");
      expect((await admin.client.rpc("admin_set_user_ban", { p_user: admin.id, p_banned: true })).error?.message).toContain("cannot_ban_self");
    });

    it("заблокированный пользователь теряет права на запись", async () => {
      expect((await admin.client.rpc("admin_set_user_ban", { p_user: bob.id, p_banned: true, p_reason: "spam" })).error).toBeNull();
      expect((await bob.client.from("favorites").insert({ user_id: bob.id, anime_id: anime.id })).error?.code).toBe("42501");
      await bob.client.from("profiles").update({ display_name: "still here" }).eq("id", bob.id);
      const { data } = await adminClient().from("profiles").select("display_name, is_banned, banned_reason").eq("id", bob.id).single();
      expect(data).toMatchObject({ is_banned: true, banned_reason: "spam" });
      expect(data?.display_name).not.toBe("still here");
      expect((await admin.client.rpc("admin_set_user_ban", { p_user: bob.id, p_banned: false })).error).toBeNull();
      expect((await bob.client.from("favorites").insert({ user_id: bob.id, anime_id: anime.id })).error).toBeNull();
    });

    it("заблокированный сотрудник теряет административные права", async () => {
      await adminClient().from("profiles").update({ is_banned: true }).eq("id", moderator.id);
      expect((await moderator.client.rpc("current_role_level")).data).toBe(0);
      expect((await moderator.client.from("anime").select("id").eq("id", draft.id)).data).toEqual([]);
      await adminClient().from("profiles").update({ is_banned: false }).eq("id", moderator.id);
      expect((await moderator.client.rpc("current_role_level")).data).toBe(50);
    });
  });

  describe("служебные данные", () => {
    it("журнал действий доступен только администраторам и не изменяется напрямую", async () => {
      expect((await alice.client.from("admin_logs").select("id")).data ?? []).toEqual([]);
      expect((await moderator.client.from("admin_logs").select("id")).data).toEqual([]);
      expect((await admin.client.from("admin_logs").select("id").limit(1)).data?.length).toBe(1);
      expect((await admin.client.from("admin_logs").insert({ action: "fake.entry" })).error).not.toBeNull();
      expect((await alice.client.rpc("log_admin_action", { p_action: "fake.entry" })).error?.message).toContain("forbidden");
    });

    it("служебные функции и таблицы недоступны через публичный API", async () => {
      expect((await alice.client.rpc("rate_limit_hit", { p_key: "x", p_limit: 1, p_window_seconds: 1 })).error).not.toBeNull();
      expect((await alice.client.rpc("expire_subscriptions")).error).not.toBeNull();
      expect((await alice.client.rpc("has_active_subscription", { p_user: bob.id })).error).not.toBeNull();
      expect((await alice.client.from("rate_limits").select("key")).error).not.toBeNull();
      expect((await alice.client.from("payment_events").select("id")).error).not.toBeNull();
      expect((await alice.client.rpc("admin_dashboard_stats")).error?.message).toContain("forbidden");
    });

    it("статистика доступна персоналу", async () => {
      const { data, error } = await moderator.client.rpc("admin_dashboard_stats");
      expect(error).toBeNull();
      expect(data).toMatchObject({ users_total: expect.any(Number), anime_total: expect.any(Number) });
      const daily = await moderator.client.rpc("admin_daily_stats", { p_days: 7 });
      expect(daily.data).toHaveLength(7);
    });

    it("настройки: публичные видны всем, закрытые и запись — только администраторам", async () => {
      const guest = await anonClient().from("site_settings").select("key");
      expect(guest.data?.map((row) => row.key)).toContain("site_name");
      expect(guest.data?.map((row) => row.key)).not.toContain("anilist_sync_batch");
      await moderator.client.from("site_settings").update({ value: true }).eq("key", "maintenance_mode");
      const { data } = await adminClient().from("site_settings").select("value").eq("key", "maintenance_mode").single();
      expect(data?.value).toBe(false);
    });

    it("уведомления: нельзя создавать и менять текст, можно отметить прочитанным", async () => {
      expect((await alice.client.from("notifications").insert({ user_id: bob.id, type: "welcome" })).error).not.toBeNull();
      const { data: own } = await alice.client.from("notifications").select("id").limit(1).single();
      expect((await alice.client.from("notifications").update({ title: "hacked" }).eq("id", own!.id)).error).not.toBeNull();
      expect((await alice.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", own!.id)).error).toBeNull();
      expect((await bob.client.from("notifications").select("id").eq("id", own!.id)).data).toEqual([]);
    });

    it("учёт просмотров: не чаще одного события на пользователя и серию", async () => {
      expect((await alice.client.rpc("record_view", { p_episode: anime.freeEpisodeId })).data).toBe(true);
      expect((await alice.client.rpc("record_view", { p_episode: anime.freeEpisodeId })).data).toBe(false);
      expect((await bob.client.rpc("record_view", { p_episode: anime.premiumEpisodeId })).data).toBe(false);
      const { data } = await adminClient().from("anime").select("views_count").eq("id", anime.id).single();
      expect(data?.views_count).toBe(1);
    });

    it("ограничитель частоты считает запросы в окне", async () => {
      const db = adminClient();
      const key = `test:${RUN_ID}`;
      const hits = [];
      for (let index = 0; index < 4; index += 1) hits.push((await db.rpc("rate_limit_hit", { p_key: key, p_limit: 2, p_window_seconds: 60 })).data);
      expect(hits).toEqual([true, true, false, false]);
      await db.from("rate_limits").delete().eq("key", key);
    });
  });

  describe("хранилище файлов", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);

    it("аватар загружается только в собственную папку", async () => {
      const own = await alice.client.storage.from("avatars").upload(`${alice.id}/a.png`, png, { contentType: "image/png", upsert: true });
      expect(own.error).toBeNull();
      const foreign = await alice.client.storage.from("avatars").upload(`${bob.id}/a.png`, png, { contentType: "image/png" });
      expect(foreign.error).not.toBeNull();
      await alice.client.storage.from("avatars").remove([`${alice.id}/a.png`]);
    });

    it("бакет отклоняет недопустимый тип файла", async () => {
      const { error } = await alice.client.storage.from("avatars").upload(`${alice.id}/x.html`, new TextEncoder().encode("<script>"), { contentType: "text/html" });
      expect(error).not.toBeNull();
    });

    it("постеры загружает только персонал", async () => {
      const path = `test/${RUN_ID}.png`;
      expect((await alice.client.storage.from("posters").upload(path, png, { contentType: "image/png" })).error).not.toBeNull();
      expect((await moderator.client.storage.from("posters").upload(path, png, { contentType: "image/png" })).error).toBeNull();
      await moderator.client.storage.from("posters").remove([path]);
    });
  });
});

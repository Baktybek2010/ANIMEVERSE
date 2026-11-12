import { afterAll, describe, expect, it } from "vitest";
import { importMedia } from "@/lib/anilist/import";
import type { AniListMedia } from "@/lib/anilist/types";
import { adminClient, hasLocalSupabase } from "../helpers/supabase";

/** Импорт AniList в реальную базу: без дублей и без перезаписи ручных правок. */
describe.skipIf(!hasLocalSupabase)("импорт AniList", () => {
  const db = adminClient();
  // Идентификаторы из диапазона, которого нет в AniList, — чтобы не пересечься с настоящими данными.
  const baseId = 900_000_000 + Math.floor(Math.random() * 1_000_000);

  const media = (id: number, patch: Partial<AniListMedia> = {}): AniListMedia => ({
    id,
    idMal: null,
    title: { romaji: `Import Test ${id}`, english: `Import Test EN ${id}`, native: "インポートテスト" },
    synonyms: [],
    description: "Original description.",
    format: "TV",
    status: "FINISHED",
    season: "SPRING",
    seasonYear: 2020,
    startDate: { year: 2020, month: 4, day: 1 },
    endDate: { year: 2020, month: 6, day: 30 },
    episodes: 12,
    duration: 24,
    averageScore: 80,
    meanScore: 80,
    popularity: 1000,
    trending: 5,
    genres: ["Action", "Drama"],
    isAdult: false,
    countryOfOrigin: "JP",
    source: "ORIGINAL",
    coverImage: { extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/test.jpg", large: null, color: "#123456" },
    bannerImage: null,
    trailer: null,
    studios: { nodes: [{ name: "Test Studio" }] },
    ...patch,
  });

  const row = async (id: number) =>
    (await db.from("anime").select("id, slug, score, description, is_published, locked_fields, genre_slugs, anime_translations (locale, title, description, is_manual)").eq("anilist_id", id).single()).data!;

  afterAll(async () => {
    await db.from("anime").delete().gte("anilist_id", baseId).lt("anilist_id", baseId + 10);
  });

  it("создаёт запись с переводами и жанрами", async () => {
    const summary = await importMedia(db, [media(baseId)], { publish: true });
    expect(summary).toMatchObject({ created: 1, updated: 0, failed: [] });
    const anime = await row(baseId);
    expect(anime.slug).toBe(`import-test-${baseId}`);
    expect(anime.is_published).toBe(true);
    expect(anime.score).toBe(8);
    expect(anime.genre_slugs).toEqual(["action", "drama"]);
    expect(anime.anime_translations.find((item) => item.locale === "en")).toMatchObject({ title: `Import Test EN ${baseId}`, description: "Original description.", is_manual: false });
    expect(anime.anime_translations.find((item) => item.locale === "ja")?.title).toBe("インポートテスト");
  });

  it("повторный импорт обновляет запись и не создаёт дубликат", async () => {
    const summary = await importMedia(db, [media(baseId, { averageScore: 91 })]);
    expect(summary).toMatchObject({ created: 0, updated: 1 });
    const { count } = await db.from("anime").select("id", { count: "exact", head: true }).eq("anilist_id", baseId);
    expect(count).toBe(1);
    expect((await row(baseId)).score).toBe(9.1);
  });

  it("при совпадении названий подбирает уникальный slug", async () => {
    const summary = await importMedia(db, [media(baseId + 1, { title: { romaji: `Import Test ${baseId}`, english: null, native: null } })]);
    expect(summary.created).toBe(1);
    expect((await row(baseId + 1)).slug).toBe(`import-test-${baseId}-2020`);
  });

  it("не перезаписывает поля и переводы, изменённые вручную", async () => {
    const anime = await row(baseId);
    await db.from("anime").update({ description: "Manual description", locked_fields: ["description", "genres"] }).eq("id", anime.id);
    await db.from("anime_translations").upsert({ anime_id: anime.id, locale: "en", title: "Manual EN title", description: "Manual EN", is_manual: true });
    await db.from("anime_translations").upsert({ anime_id: anime.id, locale: "ru", title: "Ручное название", description: "Ручное описание", is_manual: true });

    await importMedia(db, [media(baseId, { description: "Changed upstream", averageScore: 70, genres: ["Comedy"] })]);
    const updated = await row(baseId);
    expect(updated.description).toBe("Manual description");
    expect(updated.score).toBe(7);
    expect(updated.genre_slugs).toEqual(["action", "drama"]);
    expect(updated.anime_translations.find((item) => item.locale === "en")?.title).toBe("Manual EN title");
    expect(updated.anime_translations.find((item) => item.locale === "ru")?.title).toBe("Ручное название");
  });

  it("принудительная синхронизация перезаписывает ручные правки AniList-полей, но не русский перевод", async () => {
    await importMedia(db, [media(baseId, { description: "Changed upstream", genres: ["Comedy"] })], { force: true });
    const updated = await row(baseId);
    expect(updated.description).toBe("Changed upstream");
    expect(updated.genre_slugs).toEqual(["comedy"]);
    expect(updated.anime_translations.find((item) => item.locale === "en")?.title).toBe(`Import Test EN ${baseId}`);
    expect(updated.anime_translations.find((item) => item.locale === "ru")?.title).toBe("Ручное название");
  });

  it("в режиме обновления не создаёт новые записи и не меняет статус публикации", async () => {
    await db.from("anime").update({ is_published: false }).eq("anilist_id", baseId);
    const summary = await importMedia(db, [media(baseId), media(baseId + 2)], { updateOnly: true, publish: true });
    expect(summary).toMatchObject({ created: 0, updated: 1, skipped: 1 });
    expect((await row(baseId)).is_published).toBe(false);
  });

  it("создаёт отсутствующий жанр и пропускает исключённые", async () => {
    const genre = `Zzgenre ${baseId}`;
    await importMedia(db, [media(baseId + 3, { genres: [genre, "Hentai"] })]);
    const anime = await row(baseId + 3);
    expect(anime.genre_slugs).toEqual([`zzgenre-${baseId}`]);
    await db.from("genres").delete().eq("slug", `zzgenre-${baseId}`);
  });
});

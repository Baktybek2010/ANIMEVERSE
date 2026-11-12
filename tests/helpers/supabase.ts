import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Читает .env.local, не перезаписывая уже заданные переменные окружения. */
export function loadEnv() {
  const file = resolve(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

loadEnv();

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Интеграционные тесты выполняются только на локальном стеке — никогда на боевой базе. */
export const hasLocalSupabase = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY) && /^http:\/\/(127\.0\.0\.1|localhost)/.test(SUPABASE_URL);

export type Db = SupabaseClient<Database>;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export const adminClient = (): Db => createClient<Database>(SUPABASE_URL, SERVICE_KEY, clientOptions);
export const anonClient = (): Db => createClient<Database>(SUPABASE_URL, ANON_KEY, clientOptions);

export type TestUser = { id: string; email: string; password: string; username: string; client: Db };

const created: string[] = [];
export const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Создаёт подтверждённого пользователя с ролью и возвращает клиент с его сессией. */
export async function createTestUser(role: "user" | "moderator" | "admin" | "super_admin" = "user", label: string = role): Promise<TestUser> {
  const admin = adminClient();
  const username = `t_${label}_${RUN_ID}`.slice(0, 24);
  const email = `${username}@test.animeverse.local`;
  const password = `Test-${RUN_ID}-9x`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, locale: "ru" } });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  created.push(data.user.id);
  if (role !== "user") {
    const { error: roleError } = await admin.from("profiles").update({ role }).eq("id", data.user.id);
    if (roleError) throw new Error(`set role: ${roleError.message}`);
  }
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return { id: data.user.id, email, password, username, client };
}

export async function cleanupTestUsers() {
  const admin = adminClient();
  for (const id of created.splice(0)) await admin.auth.admin.deleteUser(id);
}

/** Тестовое аниме с бесплатной и Premium-серией; возвращает идентификаторы. */
export async function createTestAnime(options: { published?: boolean } = {}) {
  const admin = adminClient();
  const slug = `test-${RUN_ID}-${Math.random().toString(36).slice(2, 8)}`;
  const { data: anime, error } = await admin
    .from("anime")
    .insert({ slug, title_romaji: `Test ${slug}`, is_published: options.published ?? true, format: "tv", status: "ongoing" })
    .select("id, slug")
    .single();
  if (error || !anime) throw new Error(`anime: ${error?.message}`);
  const { data: season } = await admin.from("seasons").insert({ anime_id: anime.id, number: 1 }).select("id").single();
  const episode = async (number: number, isPremium: boolean) => {
    const { data, error: episodeError } = await admin
      .from("episodes")
      .insert({ anime_id: anime.id, season_id: season!.id, number, is_premium: isPremium, is_published: true, duration_seconds: 1440 })
      .select("id")
      .single();
    if (episodeError || !data) throw new Error(`episode: ${episodeError?.message}`);
    await admin.from("episode_sources").insert({ episode_id: data.id, kind: "mp4", url: `https://media.example.com/${slug}/${number}.mp4`, quality: "720p", audio_lang: "ja" });
    return data.id;
  };
  return { id: anime.id, slug: anime.slug, seasonId: season!.id, freeEpisodeId: await episode(1, false), premiumEpisodeId: await episode(2, true) };
}

export async function deleteTestAnime(id: string) {
  await adminClient().from("anime").delete().eq("id", id);
}

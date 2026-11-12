import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../helpers/supabase";
import { startMediaServer } from "./media-server";

const STATE_FILE = resolve(__dirname, ".auth/state.json");
const MEDIA_DIR = resolve(__dirname, ".auth/media");
const MEDIA_PORT = Number(process.env.E2E_MEDIA_PORT ?? 4455);

/** Короткий тестовый ролик (таблица настройки + тон) — собственный, без чужих прав. */
function generateVideo(): boolean {
  const file = resolve(MEDIA_DIR, "sample.webm");
  if (existsSync(file)) return true;
  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=duration=40:size=320x180:rate=12", "-f", "lavfi", "-i", "sine=frequency=440:duration=40",
        "-c:v", "libvpx", "-b:v", "150k", "-c:a", "libvorbis", "-shortest", file],
      { stdio: "pipe" },
    );
    return true;
  } catch {
    console.warn("ffmpeg недоступен — тесты плеера будут пропущены");
    return false;
  }
}

export default async function globalSetup() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url) || !key) {
    throw new Error("E2E-тесты запускаются только на локальном Supabase (npm run supabase:up) с ключами в .env.local");
  }
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  mkdirSync(MEDIA_DIR, { recursive: true });
  writeFileSync(resolve(MEDIA_DIR, "sample.vtt"), "WEBVTT\n\n00:00.000 --> 00:30.000\nТестовые субтитры\n");
  const hasVideo = generateVideo();
  await startMediaServer(MEDIA_DIR, MEDIA_PORT);

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const runId = Date.now().toString(36);
  const password = `E2e-${runId}-pass9`;
  await db.from("rate_limits").delete().neq("key", "");

  const users = {} as Record<string, { id: string; email: string; username: string }>;
  for (const [name, role] of [["user", "user"], ["viewer", "user"], ["admin", "super_admin"]] as const) {
    const username = `e2e_${name}_${runId}`;
    const email = `${username}@test.animeverse.local`;
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, locale: "ru" } });
    if (error || !data.user) throw new Error(`Не удалось создать пользователя ${name}: ${error?.message}`);
    if (role !== "user") await db.from("profiles").update({ role }).eq("id", data.user.id);
    users[name] = { id: data.user.id, email, username };
  }

  const slug = `e2e-anime-${runId}`;
  const title = `E2E Аниме ${runId}`;
  const { data: anime, error } = await db
    .from("anime")
    .insert({ slug, title_romaji: `E2E Anime ${runId}`, description: "Тестовое описание.", format: "tv", status: "ongoing", season_year: 2024, score: 9.9, popularity: 1, is_published: true })
    .select("id")
    .single();
  if (error || !anime) throw new Error(`Не удалось создать аниме: ${error?.message}`);
  await db.from("anime_translations").insert({ anime_id: anime.id, locale: "ru", title, description: "Тестовое описание на русском.", is_manual: true });
  const { data: genre } = await db.from("genres").select("id").eq("slug", "mecha").single();
  if (genre) await db.from("anime_genres").insert({ anime_id: anime.id, genre_id: genre.id });
  const { data: season } = await db.from("seasons").insert({ anime_id: anime.id, number: 1 }).select("id").single();
  const media = `http://127.0.0.1:${MEDIA_PORT}`;
  for (const [number, isPremium] of [[1, false], [2, false], [3, true]] as const) {
    const { data: episode } = await db
      .from("episodes")
      .insert({ anime_id: anime.id, season_id: season!.id, number, title_ru: `Тестовая серия ${number}`, is_premium: isPremium, is_published: true, duration_seconds: 40 })
      .select("id")
      .single();
    if (hasVideo) {
      await db.from("episode_sources").insert({ episode_id: episode!.id, kind: "webm", url: `${media}/sample.webm`, quality: "360p", audio_lang: "ja", is_default: true });
      await db.from("episode_subtitles").insert({ episode_id: episode!.id, lang: "ru", label: "Русские", url: `${media}/sample.vtt` });
    }
  }

  writeFileSync(STATE_FILE, JSON.stringify({ runId, password, users, anime: { id: anime.id, slug, title, hasVideo }, mediaPort: MEDIA_PORT }, null, 2));
}

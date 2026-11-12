"use server";

import { getAniListClient } from "@/lib/anilist/client";
import { importMedia } from "@/lib/anilist/import";
import { SYNCABLE_FIELDS } from "@/lib/anilist/mapper";
import { rateLimit } from "@/lib/rate-limit";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import type { DbClient, TablesUpdate } from "@/lib/supabase/types";
import { UPLOAD_LIMITS, validateImageUpload, validateVttUpload } from "@/lib/upload";
import { animeSchema, episodeSchema, seasonSchema, sourceSchema, subtitleSchema, uuidSchema } from "@/lib/validation/admin";
import { authorize } from "../guard";
import { type ActionResult, fail, mapDbError, ok, validationFail } from "../result";
import { invalidateAnime, logAdmin } from "./shared";

async function animeSlug(db: DbClient, animeId: string): Promise<string | null> {
  const { data } = await db.from("anime").select("slug").eq("id", animeId).maybeSingle();
  return data?.slug ?? null;
}

function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => value === b[index]);
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b) && (a === null) === (b === null);
  return (a ?? null) === (b ?? null);
}

/** Создание или обновление аниме вместе с переводами и жанрами. */
export async function saveAnimeAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  const { user, denied } = await authorize("content.manage");
  if (denied) return denied;
  if (id !== null && !uuidSchema.safeParse(id).success) return fail("validation");
  const parsed = animeSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const value = parsed.data;
  const db = await createClient();

  const row = {
    title_romaji: value.title_romaji,
    title_english: value.title_english,
    title_native: value.title_native,
    synonyms: value.synonyms,
    description: value.description_en,
    format: value.format as TablesUpdate<"anime">["format"],
    status: value.status as TablesUpdate<"anime">["status"],
    season: value.season as TablesUpdate<"anime">["season"],
    season_year: value.season_year,
    start_date: value.start_date,
    end_date: value.end_date,
    episodes_total: value.episodes_total,
    episode_duration: value.episode_duration,
    score: value.score,
    studio: value.studio,
    source: value.source,
    trailer_youtube_id: value.trailer_youtube_id,
    poster_url: value.poster_url,
    banner_url: value.banner_url,
    is_published: value.is_published,
    is_featured: value.is_featured,
    is_adult: value.is_adult,
  };

  let animeId = id;
  let slug = value.slug || slugify(value.title_romaji) || `anime-${Date.now().toString(36)}`;
  let previousSlug: string | null = null;

  if (animeId) {
    const { data: existing, error } = await db.from("anime").select("*").eq("id", animeId).maybeSingle();
    if (error) return fail(mapDbError(error));
    if (!existing) return fail("notFound");
    previousSlug = existing.slug;
    if (!value.slug) slug = existing.slug;

    // Поля, изменённые вручную, блокируются от перезаписи синхронизацией AniList.
    const locked = new Set(existing.locked_fields);
    if (existing.anilist_id) {
      for (const field of SYNCABLE_FIELDS) {
        if (field in row && !same((row as Record<string, unknown>)[field], (existing as Record<string, unknown>)[field])) locked.add(field);
      }
    }
    const { data: currentGenres } = await db.from("anime_genres").select("genre_id").eq("anime_id", animeId);
    const before = (currentGenres ?? []).map((item) => item.genre_id).sort((a, b) => a - b);
    const after = [...new Set(value.genre_ids)].sort((a, b) => a - b);
    if (existing.anilist_id && !same(before, after)) locked.add("genres");

    const { error: updateError } = await db
      .from("anime")
      .update({ ...row, slug, locked_fields: [...locked] })
      .eq("id", animeId);
    if (updateError) return fail(updateError.code === "23505" ? "duplicate" : mapDbError(updateError), updateError.code === "23505" ? { slug: "duplicate" } : undefined);
  } else {
    const { data: inserted, error } = await db
      .from("anime")
      .insert({ ...row, slug, created_by: user.id })
      .select("id")
      .single();
    if (error || !inserted) return fail(error?.code === "23505" ? "duplicate" : mapDbError(error), error?.code === "23505" ? { slug: "duplicate" } : undefined);
    animeId = inserted.id;
  }

  // Жанры: заменяем набор целиком.
  const wanted = [...new Set(value.genre_ids)];
  const { data: existingGenres } = await db.from("anime_genres").select("genre_id").eq("anime_id", animeId);
  const have = new Set((existingGenres ?? []).map((item) => item.genre_id));
  const remove = [...have].filter((genreId) => !wanted.includes(genreId));
  const add = wanted.filter((genreId) => !have.has(genreId));
  if (remove.length) await db.from("anime_genres").delete().eq("anime_id", animeId).in("genre_id", remove);
  if (add.length) {
    const { error } = await db.from("anime_genres").insert(add.map((genre_id) => ({ anime_id: animeId, genre_id })));
    if (error) return fail(mapDbError(error));
  }

  // Переводы: изменённые вручную помечаются is_manual и не перезаписываются импортом.
  const { data: translations } = await db.from("anime_translations").select("locale, title, description, is_manual").eq("anime_id", animeId);
  const byLocale = new Map((translations ?? []).map((item) => [item.locale, item]));
  const next = [
    { locale: "ru", title: value.title_ru, description: value.description_ru },
    { locale: "en", title: value.title_english ?? value.title_romaji, description: value.description_en },
    { locale: "ja", title: value.title_native, description: value.description_ja },
  ];
  for (const item of next) {
    const current = byLocale.get(item.locale);
    if (!item.title && !item.description) {
      if (current) await db.from("anime_translations").delete().eq("anime_id", animeId).eq("locale", item.locale);
      continue;
    }
    if (current && same(current.title, item.title) && same(current.description, item.description)) continue;
    const { error } = await db
      .from("anime_translations")
      .upsert({ anime_id: animeId, locale: item.locale, title: item.title, description: item.description, is_manual: true }, { onConflict: "anime_id,locale" });
    if (error) return fail(mapDbError(error));
  }

  await logAdmin(db, id ? "anime.update" : "anime.create", "anime", animeId, { slug, title: value.title_romaji });
  invalidateAnime(slug);
  if (previousSlug && previousSlug !== slug) invalidateAnime(previousSlug);
  return ok({ id: animeId, slug });
}

export async function deleteAnimeAction(id: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.delete");
  if (denied) return denied;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return fail("validation");
  const db = await createClient();
  const { data: existing } = await db.from("anime").select("slug, title_romaji").eq("id", parsed.data).maybeSingle();
  if (!existing) return fail("notFound");
  const { error } = await db.from("anime").delete().eq("id", parsed.data);
  if (error) return fail(mapDbError(error));
  await logAdmin(db, "anime.delete", "anime", parsed.data, { slug: existing.slug, title: existing.title_romaji });
  invalidateAnime(existing.slug);
  return ok();
}

export async function unlockAnimeFieldsAction(id: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return fail("validation");
  const db = await createClient();
  const { error } = await db.from("anime").update({ locked_fields: [] }).eq("id", parsed.data);
  if (error) return fail(mapDbError(error));
  await logAdmin(db, "anime.unlock_fields", "anime", parsed.data);
  return ok();
}

/** Ручное обновление метаданных из AniList. force — перезаписать ручные правки. */
export async function resyncAnimeAction(id: unknown, force: boolean): Promise<ActionResult> {
  const { user, denied } = await authorize("import.run");
  if (denied) return denied;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return fail("validation");
  if (!(await rateLimit("admin.anilist", user.id, 30, 60))) return fail("rateLimited");
  const db = await createClient();
  const { data: anime } = await db.from("anime").select("anilist_id, slug").eq("id", parsed.data).maybeSingle();
  if (!anime?.anilist_id) return fail("notFound");
  try {
    const media = await getAniListClient().byIds([anime.anilist_id]);
    if (media.length === 0) return fail("notFound");
    const summary = await importMedia(db, media, { force: force === true, updateOnly: true });
    if (summary.failed.length) return fail("generic");
  } catch {
    return fail("network");
  }
  await logAdmin(db, force === true ? "anime.resync_force" : "anime.resync", "anime", parsed.data, { slug: anime.slug });
  invalidateAnime(anime.slug);
  return ok();
}

/** Загрузка изображения каталога (постер, баннер, обложка новости) в Supabase Storage. */
export async function uploadMediaAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const { user, denied } = await authorize("content.manage");
  if (denied) return denied;
  const kind = formData.get("kind");
  if (kind !== "poster" && kind !== "banner") return fail("validation");
  if (!(await rateLimit("admin.upload", user.id, 60, 600))) return fail("rateLimited");

  const check = await validateImageUpload(formData.get("file"), {
    maxBytes: kind === "poster" ? UPLOAD_LIMITS.poster : UPLOAD_LIMITS.banner,
    allowed: ["jpeg", "png", "webp", "avif"],
  });
  if (!check.ok) return fail(check.error);

  const db = await createClient();
  const bucket = kind === "poster" ? "posters" : "banners";
  const path = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${check.extension}`;
  const { error } = await db.storage.from(bucket).upload(path, check.bytes, { contentType: check.mime, cacheControl: "31536000", upsert: false });
  if (error) return fail("uploadFailed");
  return ok({ url: db.storage.from(bucket).getPublicUrl(path).data.publicUrl });
}

// ---------- Сезоны ---------------------------------------------------------

export async function saveSeasonAction(animeId: unknown, seasonId: string | null, input: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  const anime = uuidSchema.safeParse(animeId);
  if (!anime.success || (seasonId !== null && !uuidSchema.safeParse(seasonId).success)) return fail("validation");
  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const db = await createClient();
  const { error } = seasonId
    ? await db.from("seasons").update(parsed.data).eq("id", seasonId).eq("anime_id", anime.data)
    : await db.from("seasons").insert({ ...parsed.data, anime_id: anime.data });
  if (error) return fail(error.code === "23505" ? "duplicate" : mapDbError(error), error.code === "23505" ? { number: "duplicate" } : undefined);
  await logAdmin(db, seasonId ? "season.update" : "season.create", "anime", anime.data, { number: parsed.data.number });
  invalidateAnime(await animeSlug(db, anime.data));
  return ok();
}

export async function deleteSeasonAction(seasonId: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  const parsed = uuidSchema.safeParse(seasonId);
  if (!parsed.success) return fail("validation");
  const db = await createClient();
  const { data: season } = await db.from("seasons").select("anime_id, number").eq("id", parsed.data).maybeSingle();
  if (!season) return fail("notFound");
  const { error } = await db.from("seasons").delete().eq("id", parsed.data);
  if (error) return fail(mapDbError(error));
  await logAdmin(db, "season.delete", "anime", season.anime_id, { number: season.number });
  invalidateAnime(await animeSlug(db, season.anime_id));
  return ok();
}

// ---------- Эпизоды --------------------------------------------------------

export async function saveEpisodeAction(seasonId: unknown, episodeId: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  const season = uuidSchema.safeParse(seasonId);
  if (!season.success || (episodeId !== null && !uuidSchema.safeParse(episodeId).success)) return fail("validation");
  const parsed = episodeSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const db = await createClient();

  const { data: seasonRow } = await db.from("seasons").select("anime_id").eq("id", season.data).maybeSingle();
  if (!seasonRow) return fail("notFound");

  const result = episodeId
    ? await db.from("episodes").update(parsed.data).eq("id", episodeId).eq("season_id", season.data).select("id").maybeSingle()
    : await db
        .from("episodes")
        .insert({ ...parsed.data, season_id: season.data, anime_id: seasonRow.anime_id })
        .select("id")
        .maybeSingle();
  if (result.error) {
    const duplicate = result.error.code === "23505";
    return fail(duplicate ? "duplicate" : mapDbError(result.error), duplicate ? { number: "duplicate" } : undefined);
  }
  if (!result.data) return fail("notFound");
  await logAdmin(db, episodeId ? "episode.update" : "episode.create", "episode", result.data.id, { number: parsed.data.number });
  invalidateAnime(await animeSlug(db, seasonRow.anime_id));
  return ok({ id: result.data.id });
}

export async function deleteEpisodeAction(episodeId: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  const parsed = uuidSchema.safeParse(episodeId);
  if (!parsed.success) return fail("validation");
  const db = await createClient();
  const { data: episode } = await db.from("episodes").select("anime_id, number").eq("id", parsed.data).maybeSingle();
  if (!episode) return fail("notFound");
  const { error } = await db.from("episodes").delete().eq("id", parsed.data);
  if (error) return fail(mapDbError(error));
  await logAdmin(db, "episode.delete", "episode", parsed.data, { number: episode.number });
  invalidateAnime(await animeSlug(db, episode.anime_id));
  return ok();
}

// ---------- Видеоисточники и субтитры --------------------------------------

export async function saveSourceAction(episodeId: unknown, input: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  const episode = uuidSchema.safeParse(episodeId);
  if (!episode.success) return fail("validation");
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const db = await createClient();
  if (parsed.data.is_default) await db.from("episode_sources").update({ is_default: false }).eq("episode_id", episode.data);
  const { error } = await db.from("episode_sources").insert({ ...parsed.data, episode_id: episode.data });
  if (error) return fail(error.code === "23505" ? "duplicate" : error.code === "23503" ? "notFound" : mapDbError(error));
  await logAdmin(db, "source.create", "episode", episode.data, { kind: parsed.data.kind, quality: parsed.data.quality, audio: parsed.data.audio_lang });
  return ok();
}

export async function deleteSourceAction(sourceId: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  const parsed = uuidSchema.safeParse(sourceId);
  if (!parsed.success) return fail("validation");
  const db = await createClient();
  const { data, error } = await db.from("episode_sources").delete().eq("id", parsed.data).select("episode_id").maybeSingle();
  if (error) return fail(mapDbError(error));
  if (data) await logAdmin(db, "source.delete", "episode", data.episode_id);
  return ok();
}

/** Субтитры: файл WebVTT загружается в Storage либо указывается ссылка. */
export async function saveSubtitleAction(formData: FormData): Promise<ActionResult> {
  const { user, denied } = await authorize("content.manage");
  if (denied) return denied;
  const episode = uuidSchema.safeParse(formData.get("episodeId"));
  if (!episode.success) return fail("validation");
  const parsed = subtitleSchema.safeParse({
    lang: formData.get("lang") ?? "",
    label: formData.get("label") ?? "",
    url: formData.get("url") ?? "",
    is_default: formData.get("is_default") === "true",
  });
  if (!parsed.success) return validationFail(parsed.error);
  const db = await createClient();

  let url = parsed.data.url;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (!(await rateLimit("admin.upload", user.id, 60, 600))) return fail("rateLimited");
    const check = await validateVttUpload(file, UPLOAD_LIMITS.subtitles);
    if (!check.ok) return fail(check.error);
    const path = `${episode.data}/${parsed.data.lang}-${crypto.randomUUID()}.vtt`;
    const { error } = await db.storage.from("subtitles").upload(path, check.bytes, { contentType: "text/vtt", cacheControl: "86400", upsert: false });
    if (error) return fail("uploadFailed");
    url = db.storage.from("subtitles").getPublicUrl(path).data.publicUrl;
  }
  if (!url) return fail("required", { url: "required" });

  if (parsed.data.is_default) await db.from("episode_subtitles").update({ is_default: false }).eq("episode_id", episode.data);
  const { error } = await db
    .from("episode_subtitles")
    .insert({ episode_id: episode.data, lang: parsed.data.lang, label: parsed.data.label, url, is_default: parsed.data.is_default });
  if (error) return fail(error.code === "23505" ? "duplicate" : error.code === "23503" ? "notFound" : mapDbError(error));
  await logAdmin(db, "subtitle.create", "episode", episode.data, { lang: parsed.data.lang });
  return ok();
}

export async function deleteSubtitleAction(subtitleId: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  const parsed = uuidSchema.safeParse(subtitleId);
  if (!parsed.success) return fail("validation");
  const db = await createClient();
  const { data, error } = await db.from("episode_subtitles").delete().eq("id", parsed.data).select("episode_id, url").maybeSingle();
  if (error) return fail(mapDbError(error));
  if (data) {
    // Файл в собственном хранилище удаляется вместе с записью.
    const marker = "/storage/v1/object/public/subtitles/";
    const index = data.url.indexOf(marker);
    if (index >= 0) await db.storage.from("subtitles").remove([decodeURIComponent(data.url.slice(index + marker.length))]);
    await logAdmin(db, "subtitle.delete", "episode", data.episode_id);
  }
  return ok();
}

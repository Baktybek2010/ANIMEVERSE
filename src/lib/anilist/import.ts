import type { DbClient } from "@/lib/supabase/types";
import { buildSyncPatch, mapMedia } from "./mapper";
import type { AniListMedia } from "./types";

export type ImportOptions = {
  /** Публиковать новые тайтлы сразу (существующие статус публикации не меняют). */
  publish?: boolean;
  /** Перезаписывать поля и переводы, изменённые вручную. */
  force?: boolean;
  /** Только обновлять существующие записи, новые не создавать. */
  updateOnly?: boolean;
  createdBy?: string | null;
};

export type ImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  failed: { anilistId: number; title: string; reason: string }[];
  slugs: string[];
};

type GenreCache = Map<string, number>;

async function loadGenres(client: DbClient): Promise<GenreCache> {
  const { data, error } = await client.from("genres").select("id, slug");
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((genre) => [genre.slug, genre.id]));
}

async function ensureGenres(client: DbClient, cache: GenreCache, genres: { slug: string; name: string }[]): Promise<number[]> {
  const ids: number[] = [];
  for (const genre of genres) {
    let id = cache.get(genre.slug);
    if (!id) {
      // Новый жанр из AniList: переводы администратор может уточнить позже.
      const { data, error } = await client
        .from("genres")
        .upsert({ slug: genre.slug, name_en: genre.name, name_ru: genre.name, name_ja: genre.name }, { onConflict: "slug" })
        .select("id")
        .single();
      if (error || !data) continue;
      id = data.id;
      cache.set(genre.slug, id);
    }
    ids.push(id);
  }
  return ids;
}

async function uniqueSlug(client: DbClient, base: string, year: number | null, anilistId: number): Promise<string> {
  const candidates = [base, year ? `${base}-${year}` : null, `${base}-${anilistId}`].filter((value): value is string => Boolean(value));
  const { data } = await client.from("anime").select("slug").in("slug", candidates);
  const taken = new Set((data ?? []).map((row) => row.slug));
  return candidates.find((candidate) => !taken.has(candidate)) ?? `${base}-${anilistId}-${Date.now().toString(36)}`;
}

async function replaceGenres(client: DbClient, animeId: string, genreIds: number[]) {
  const { data: current } = await client.from("anime_genres").select("genre_id").eq("anime_id", animeId);
  const existing = new Set((current ?? []).map((row) => row.genre_id));
  const wanted = new Set(genreIds);
  const toRemove = [...existing].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !existing.has(id));
  if (toRemove.length) await client.from("anime_genres").delete().eq("anime_id", animeId).in("genre_id", toRemove);
  if (toAdd.length) await client.from("anime_genres").insert(toAdd.map((genre_id) => ({ anime_id: animeId, genre_id })));
}

/** Переводы из AniList (en — название и описание, ja — название). Ручные переводы не трогаем. */
async function syncTranslations(
  client: DbClient,
  animeId: string,
  mapped: ReturnType<typeof mapMedia>["anime"],
  force: boolean,
) {
  const { data: existing } = await client.from("anime_translations").select("locale, is_manual").eq("anime_id", animeId);
  const manual = new Set((existing ?? []).filter((row) => row.is_manual).map((row) => row.locale));
  const rows = [
    { locale: "en", title: mapped.title_english ?? mapped.title_romaji, description: mapped.description },
    { locale: "ja", title: mapped.title_native, description: null },
  ].filter((row) => row.title && (force || !manual.has(row.locale)));
  if (rows.length === 0) return;
  await client.from("anime_translations").upsert(
    rows.map((row) => ({ anime_id: animeId, locale: row.locale, title: row.title, description: row.description, is_manual: false })),
    { onConflict: "anime_id,locale" },
  );
}

/**
 * Импорт/обновление тайтлов AniList в собственную базу.
 *  - дубликаты исключены: запись ищется по уникальному anilist_id;
 *  - поля из locked_fields и ручные переводы не перезаписываются без force;
 *  - slug, публикация и «избранность» существующих записей не меняются.
 */
export async function importMedia(client: DbClient, mediaList: AniListMedia[], options: ImportOptions = {}): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0, failed: [], slugs: [] };
  if (mediaList.length === 0) return summary;

  const genreCache = await loadGenres(client);
  const ids = mediaList.map((media) => media.id);
  const { data: existingRows, error: existingError } = await client
    .from("anime")
    .select("id, slug, anilist_id, locked_fields")
    .in("anilist_id", ids);
  if (existingError) throw new Error(existingError.message);
  const existingByAnilist = new Map((existingRows ?? []).map((row) => [row.anilist_id, row]));
  const now = new Date().toISOString();

  for (const media of mediaList) {
    const mapped = mapMedia(media);
    try {
      const existing = existingByAnilist.get(media.id);
      if (existing) {
        const patch = buildSyncPatch(mapped.anime, existing.locked_fields, options.force);
        const { error } = await client
          .from("anime")
          .update({ ...patch, anilist_synced_at: now })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        if (options.force || !existing.locked_fields.includes("genres")) {
          await replaceGenres(client, existing.id, await ensureGenres(client, genreCache, mapped.genres));
        }
        await syncTranslations(client, existing.id, mapped.anime, Boolean(options.force));
        summary.updated += 1;
        summary.slugs.push(existing.slug);
        continue;
      }

      if (options.updateOnly) {
        summary.skipped += 1;
        continue;
      }

      const slug = await uniqueSlug(client, mapped.slugBase, mapped.anime.season_year, media.id);
      const { data: inserted, error } = await client
        .from("anime")
        .insert({
          ...mapped.anime,
          slug,
          is_published: Boolean(options.publish),
          anilist_synced_at: now,
          created_by: options.createdBy ?? null,
        })
        .select("id, slug")
        .single();
      if (error || !inserted) {
        // Гонка: запись с таким anilist_id уже создана параллельным импортом.
        if (error?.code === "23505") {
          summary.skipped += 1;
          continue;
        }
        throw new Error(error?.message ?? "insert failed");
      }
      const genreIds = await ensureGenres(client, genreCache, mapped.genres);
      if (genreIds.length) {
        await client.from("anime_genres").insert(genreIds.map((genre_id) => ({ anime_id: inserted.id, genre_id })));
      }
      await syncTranslations(client, inserted.id, mapped.anime, true);
      summary.created += 1;
      summary.slugs.push(inserted.slug);
    } catch (error) {
      summary.failed.push({
        anilistId: media.id,
        title: mapped.anime.title_romaji,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return summary;
}

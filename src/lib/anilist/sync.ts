import type { DbClient } from "@/lib/supabase/types";
import type { AniListClient } from "./client";
import { type ImportSummary, importMedia } from "./import";

/**
 * Автоматическое обновление метаданных: сначала онгоинги и анонсы, не обновлявшиеся
 * больше суток, затем остальные тайтлы, не обновлявшиеся больше недели.
 */
export async function syncStaleAnime(db: DbClient, anilist: AniListClient, limit = 20): Promise<ImportSummary> {
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const { data: active, error: activeError } = await db
    .from("anime")
    .select("anilist_id")
    .not("anilist_id", "is", null)
    .in("status", ["ongoing", "announced"])
    .or(`anilist_synced_at.is.null,anilist_synced_at.lt.${dayAgo}`)
    .order("anilist_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (activeError) throw new Error(activeError.message);

  const ids = new Set<number>((active ?? []).flatMap((row) => (row.anilist_id ? [row.anilist_id] : [])));

  if (ids.size < limit) {
    const { data: rest, error: restError } = await db
      .from("anime")
      .select("anilist_id")
      .not("anilist_id", "is", null)
      .or(`anilist_synced_at.is.null,anilist_synced_at.lt.${weekAgo}`)
      .order("anilist_synced_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (restError) throw new Error(restError.message);
    for (const row of rest ?? []) {
      if (ids.size >= limit) break;
      if (row.anilist_id) ids.add(row.anilist_id);
    }
  }

  if (ids.size === 0) return { created: 0, updated: 0, skipped: 0, failed: [], slugs: [] };
  const media = await anilist.byIds([...ids]);
  return importMedia(db, media, { updateOnly: true });
}

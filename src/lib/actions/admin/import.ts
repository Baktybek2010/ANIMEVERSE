"use server";

import { z } from "zod";
import { AniListError, currentAniListSeason, getAniListClient } from "@/lib/anilist/client";
import { importMedia } from "@/lib/anilist/import";
import { syncStaleAnime } from "@/lib/anilist/sync";
import type { AniListMedia } from "@/lib/anilist/types";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { normalizeQuery } from "@/lib/utils";
import { importSchema } from "@/lib/validation/admin";
import { authorize } from "../guard";
import { type ActionResult, fail, ok, validationFail } from "../result";
import { invalidateAnime, logAdmin } from "./shared";

export type AniListCandidate = {
  id: number;
  title: string;
  titleNative: string | null;
  format: string | null;
  year: number | null;
  episodes: number | null;
  score: number | null;
  cover: string | null;
  inCatalog: boolean;
};

const searchSchema = z.object({
  query: z.string().max(80).optional(),
  collection: z.enum(["popular", "trending", "season", "top"]).optional(),
  page: z.coerce.number().int().min(1).max(50).default(1),
});

function toCandidate(media: AniListMedia, existing: Set<number>): AniListCandidate {
  return {
    id: media.id,
    title: media.title.english ?? media.title.romaji ?? media.title.native ?? `#${media.id}`,
    titleNative: media.title.native,
    format: media.format,
    year: media.seasonYear ?? media.startDate?.year ?? null,
    episodes: media.episodes,
    score: media.averageScore ? media.averageScore / 10 : null,
    cover: media.coverImage?.large ?? media.coverImage?.extraLarge ?? null,
    inCatalog: existing.has(media.id),
  };
}

/** Поиск в AniList для импорта (запросы кешируются клиентом AniList на 10 минут). */
export async function searchAniListAction(input: unknown): Promise<ActionResult<{ items: AniListCandidate[]; hasNext: boolean; page: number }>> {
  const { user, denied } = await authorize("import.run");
  if (denied) return denied;
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  if (!(await rateLimit("admin.anilist", user.id, 30, 60))) return fail("rateLimited");

  const query = normalizeQuery(parsed.data.query);
  const { page, collection } = parsed.data;
  if (!query && !collection) return fail("validation");

  try {
    const anilist = getAniListClient();
    const { season, year } = currentAniListSeason();
    const result = query
      ? await anilist.search(query, page, 24)
      : await anilist.page({
          page,
          perPage: 24,
          ...(collection === "trending"
            ? { sort: ["TRENDING_DESC"] }
            : collection === "season"
              ? { season, seasonYear: year, sort: ["POPULARITY_DESC"] }
              : collection === "top"
                ? { sort: ["SCORE_DESC"] }
                : { sort: ["POPULARITY_DESC"] }),
        });

    const db = await createClient();
    const ids = result.media.map((media) => media.id);
    const { data: existing } = ids.length ? await db.from("anime").select("anilist_id").in("anilist_id", ids) : { data: [] };
    const existingIds = new Set((existing ?? []).flatMap((row) => (row.anilist_id ? [row.anilist_id] : [])));
    return ok({
      items: result.media.map((media) => toCandidate(media, existingIds)),
      hasNext: Boolean(result.pageInfo.hasNextPage),
      page,
    });
  } catch (error) {
    return fail(error instanceof AniListError && error.status === 429 ? "rateLimited" : "network");
  }
}

/** Импорт выбранных тайтлов в каталог. Существующие обновляются, дубликаты не создаются. */
export async function importAniListAction(input: unknown): Promise<ActionResult<{ created: number; updated: number; skipped: number; failed: number }>> {
  const { user, denied } = await authorize("import.run");
  if (denied) return denied;
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  if (!(await rateLimit("admin.anilist.import", user.id, 20, 60))) return fail("rateLimited");

  try {
    const media = await getAniListClient().byIds([...new Set(parsed.data.ids)]);
    const db = await createClient();
    const summary = await importMedia(db, media, { publish: parsed.data.publish, createdBy: user.id });
    await logAdmin(db, "anilist.import", "anime", null, {
      created: summary.created,
      updated: summary.updated,
      failed: summary.failed.length,
    });
    invalidateAnime();
    return ok({ created: summary.created, updated: summary.updated, skipped: summary.skipped, failed: summary.failed.length });
  } catch (error) {
    return fail(error instanceof AniListError && error.status === 429 ? "rateLimited" : "network");
  }
}

/** Ручной запуск обновления устаревших метаданных. */
export async function syncAniListNowAction(): Promise<ActionResult<{ updated: number }>> {
  const { user, denied } = await authorize("import.run");
  if (denied) return denied;
  if (!(await rateLimit("admin.anilist.sync", user.id, 6, 600))) return fail("rateLimited");
  try {
    const db = await createClient();
    const summary = await syncStaleAnime(db, getAniListClient(), 25);
    await logAdmin(db, "anilist.sync", "anime", null, { updated: summary.updated, failed: summary.failed.length });
    if (summary.updated > 0) invalidateAnime();
    return ok({ updated: summary.updated });
  } catch (error) {
    return fail(error instanceof AniListError && error.status === 429 ? "rateLimited" : "network");
  }
}

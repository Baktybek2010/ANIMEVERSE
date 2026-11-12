import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { AniListError, getAniListClient } from "@/lib/anilist/client";
import { syncStaleAnime } from "@/lib/anilist/sync";
import { isAuthorizedCron } from "@/lib/cron";
import { CACHE_TAGS } from "@/lib/data/tags";
import { getAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/** Автоматическое обновление метаданных AniList для устаревших записей каталога. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getAdminClient();
  if (!db) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: settings } = await db.from("site_settings").select("key, value").in("key", ["anilist_auto_sync", "anilist_sync_batch"]);
  const map = new Map((settings ?? []).map((row) => [row.key, row.value]));
  if (map.get("anilist_auto_sync") === false) return NextResponse.json({ skipped: "disabled" });
  const batch = typeof map.get("anilist_sync_batch") === "number" ? Math.min(50, Math.max(1, map.get("anilist_sync_batch") as number)) : 20;

  try {
    const summary = await syncStaleAnime(db, getAniListClient(), batch);
    if (summary.updated > 0) revalidateTag(CACHE_TAGS.anime, "max");
    return NextResponse.json({ updated: summary.updated, failed: summary.failed.length });
  } catch (error) {
    if (error instanceof AniListError && error.status === 429) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

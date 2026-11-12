/**
 * Первичное наполнение каталога реальными данными AniList.
 *
 *   npm run seed:anilist            — ~150 тайтлов (популярное, тренды, текущий сезон, топ)
 *   npm run seed:anilist -- --pages=6   — больше страниц в каждой подборке
 *
 * Требует NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (читаются из .env.local).
 * Повторный запуск безопасен: существующие тайтлы обновляются, дубликаты не создаются.
 */
import { createClient } from "@supabase/supabase-js";
import { createAniListClient, currentAniListSeason } from "../src/lib/anilist/client";
import { importMedia } from "../src/lib/anilist/import";
import type { AniListMedia } from "../src/lib/anilist/types";
import type { Database } from "../src/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Укажите NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local");
  process.exit(1);
}

const pagesArg = process.argv.find((arg) => arg.startsWith("--pages="));
const pages = Math.min(20, Math.max(1, Number.parseInt(pagesArg?.split("=")[1] ?? "1", 10) || 1));

const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anilist = createAniListClient({ cacheTtlMs: 0 });
const { season, year } = currentAniListSeason();

const collections: { label: string; variables: Parameters<typeof anilist.page>[0] }[] = [
  { label: "Популярное", variables: { sort: ["POPULARITY_DESC"] } },
  { label: "В тренде", variables: { sort: ["TRENDING_DESC"] } },
  { label: `Сезон ${season} ${year}`, variables: { season, seasonYear: year, sort: ["POPULARITY_DESC"] } },
  { label: "Сейчас выходит", variables: { status: "RELEASING", sort: ["POPULARITY_DESC"] } },
  { label: "Лучшие по рейтингу", variables: { sort: ["SCORE_DESC"] } },
];

async function main() {
  const media = new Map<number, AniListMedia>();
  for (const collection of collections) {
    for (let page = 1; page <= pages; page += 1) {
      const result = await anilist.page({ ...collection.variables, page, perPage: 50 });
      for (const item of result.media) media.set(item.id, item);
      console.log(`AniList · ${collection.label} · страница ${page}: ${result.media.length}`);
      if (!result.pageInfo.hasNextPage) break;
    }
  }

  const summary = await importMedia(db, [...media.values()], { publish: true });
  console.log(
    `Готово: создано ${summary.created}, обновлено ${summary.updated}, пропущено ${summary.skipped}, ошибок ${summary.failed.length}`,
  );
  for (const failure of summary.failed.slice(0, 10)) {
    console.warn(`  ✗ ${failure.title} (#${failure.anilistId}): ${failure.reason}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

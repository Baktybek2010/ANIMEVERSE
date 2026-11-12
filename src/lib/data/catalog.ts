import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/i18n/config";
import { isSupabaseConfigured } from "@/lib/env";
import { getPublicClient } from "@/lib/supabase/public";
import { escapeLike } from "@/lib/utils";
import type { CatalogFilters } from "@/lib/validation/catalog";
import { localizedDescription, localizedField, localizedTitle } from "./localize";
import { CACHE_TAGS } from "./tags";
import type {
  AnimeCardData,
  AnimeDetail,
  GenreData,
  HeroSlide,
  LatestEpisode,
  NewsItem,
  PlanData,
  SeasonData,
} from "./types";

export const CATALOG_PAGE_SIZE = 24;

const CARD_BASE_COLUMNS =
  "id, slug, title_romaji, title_english, title_native, poster_url, poster_color, banner_url, score, season_year, format, status, episodes_total, is_adult, genre_slugs" as const;
const CARD_COLUMNS = `${CARD_BASE_COLUMNS}, anime_translations (locale, title)` as const;
/** Карточка с описанием — для главного баннера. */
const CARD_WITH_DESCRIPTION = `${CARD_BASE_COLUMNS}, description, is_published, anime_translations (locale, title, description)` as const;

type CardRow = {
  id: string;
  slug: string;
  title_romaji: string;
  title_english: string | null;
  title_native: string | null;
  poster_url: string | null;
  poster_color: string | null;
  banner_url: string | null;
  score: number | null;
  season_year: number | null;
  format: AnimeCardData["format"];
  status: AnimeCardData["status"];
  episodes_total: number | null;
  is_adult: boolean;
  genre_slugs: string[];
  anime_translations: { locale: string; title: string | null }[] | null;
};

export function toCard(locale: Locale, row: CardRow): AnimeCardData {
  return {
    id: row.id,
    slug: row.slug,
    title: localizedTitle(locale, row),
    posterUrl: row.poster_url,
    posterColor: row.poster_color,
    bannerUrl: row.banner_url,
    score: row.score,
    year: row.season_year,
    format: row.format,
    status: row.status,
    episodesTotal: row.episodes_total,
    isAdult: row.is_adult,
    genreSlugs: row.genre_slugs,
  };
}

export { CARD_COLUMNS };
export type { CardRow };

function fail(scope: string, error: { message: string }): never {
  throw new Error(`[data:${scope}] ${error.message}`);
}

export type AnimeListKind = "popular" | "top" | "new" | "airing" | "featured" | "trending";

/** Подборки для главной страницы. */
export async function getAnimeList(kind: AnimeListKind, locale: Locale, limit = 18): Promise<AnimeCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.anime);
  if (!isSupabaseConfigured) return [];

  let query = getPublicClient().from("anime").select(CARD_COLUMNS).eq("is_published", true).eq("is_adult", false);

  switch (kind) {
    case "popular":
      query = query.order("popularity", { ascending: false });
      break;
    case "top":
      query = query.not("score", "is", null).order("score", { ascending: false }).order("popularity", { ascending: false });
      break;
    case "new":
      query = query
        .not("start_date", "is", null)
        .lte("start_date", new Date().toISOString().slice(0, 10))
        .order("start_date", { ascending: false });
      break;
    case "airing":
      query = query.eq("status", "ongoing").order("popularity", { ascending: false });
      break;
    case "featured":
      query = query.eq("is_featured", true).order("popularity", { ascending: false });
      break;
    case "trending":
      query = query.order("trending", { ascending: false }).order("popularity", { ascending: false });
      break;
  }

  const { data, error } = await query.limit(limit);
  if (error) fail(`list:${kind}`, error);
  return (data ?? []).map((row) => toCard(locale, row));
}

export type CatalogResult = {
  items: AnimeCardData[];
  total: number;
  page: number;
  totalPages: number;
};

/** Каталог с поиском, фильтрами, сортировкой и постраничной выдачей. */
export async function searchCatalog(filters: CatalogFilters, locale: Locale): Promise<CatalogResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.anime);
  if (!isSupabaseConfigured) return { items: [], total: 0, page: 1, totalPages: 1 };

  let query = getPublicClient()
    .from("anime")
    .select(CARD_COLUMNS, { count: "exact" })
    .eq("is_published", true)
    .eq("is_adult", false);

  if (filters.q) query = query.ilike("search_text", `%${escapeLike(filters.q.toLowerCase())}%`);
  if (filters.genres.length) query = query.contains("genre_slugs", filters.genres);
  if (filters.year) query = query.eq("season_year", filters.year);
  if (filters.season) query = query.eq("season", filters.season);
  if (filters.format) query = query.eq("format", filters.format);
  if (filters.status) query = query.eq("status", filters.status);

  switch (filters.sort) {
    case "score":
      query = query.order("score", { ascending: false, nullsFirst: false });
      break;
    case "newest":
      query = query.order("start_date", { ascending: false, nullsFirst: false });
      break;
    case "title":
      query = query.order("title_romaji", { ascending: true });
      break;
    case "added":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("popularity", { ascending: false });
  }
  // Стабильный порядок при одинаковых значениях сортировки.
  query = query.order("id", { ascending: true });

  const from = (filters.page - 1) * CATALOG_PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + CATALOG_PAGE_SIZE - 1);
  // Запрошенная страница за пределами результата — не ошибка, а пустая выдача.
  if (error && error.code !== "PGRST103") fail("catalog", error);

  const total = count ?? 0;
  return {
    items: (data ?? []).map((row) => toCard(locale, row)),
    total,
    page: filters.page,
    totalPages: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
  };
}

/** Быстрые подсказки для строки поиска. */
export async function searchSuggestions(q: string, locale: Locale, limit = 6): Promise<AnimeCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.anime);
  if (!isSupabaseConfigured || q.length < 2) return [];

  const { data, error } = await getPublicClient()
    .from("anime")
    .select(CARD_COLUMNS)
    .eq("is_published", true)
    .eq("is_adult", false)
    .ilike("search_text", `%${escapeLike(q.toLowerCase())}%`)
    .order("popularity", { ascending: false })
    .limit(limit);
  if (error) fail("suggestions", error);
  return (data ?? []).map((row) => toCard(locale, row));
}

export async function getGenres(locale: Locale): Promise<GenreData[]> {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.genres);
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getPublicClient().from("genres").select("id, slug, name_ru, name_en, name_ja");
  if (error) fail("genres", error);
  return (data ?? [])
    .map((genre) => ({
      id: genre.id,
      slug: genre.slug,
      name: localizedField(locale, { ru: genre.name_ru, en: genre.name_en, ja: genre.name_ja }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Диапазон годов, представленных в каталоге (для фильтра). */
export async function getCatalogYears(): Promise<number[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.anime);
  if (!isSupabaseConfigured) return [];

  const base = () =>
    getPublicClient().from("anime").select("season_year").eq("is_published", true).not("season_year", "is", null).limit(1);
  const [oldest, newest] = await Promise.all([
    base().order("season_year", { ascending: true }),
    base().order("season_year", { ascending: false }),
  ]);
  const min = oldest.data?.[0]?.season_year;
  const max = newest.data?.[0]?.season_year;
  if (!min || !max) return [];
  const years: number[] = [];
  for (let year = max; year >= min; year -= 1) years.push(year);
  return years;
}

/** Полные данные страницы аниме: переводы, жанры, сезоны и опубликованные серии. */
export async function getAnimeBySlug(slug: string, locale: Locale): Promise<AnimeDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.anime, CACHE_TAGS.animeBySlug(slug), CACHE_TAGS.genres, CACHE_TAGS.episodes);
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getPublicClient()
    .from("anime")
    .select(
      `id, slug, title_romaji, title_english, title_native, description, poster_url, poster_color, banner_url, score,
       season, season_year, start_date, end_date, format, status, episodes_total, episode_duration, views_count,
       studio, source, trailer_youtube_id, is_adult, genre_slugs, updated_at,
       anime_translations (locale, title, description),
       anime_genres (genres (id, slug, name_ru, name_en, name_ja)),
       seasons (id, number, title_ru, title_en, title_ja,
         episodes (id, number, title_ru, title_en, title_ja, thumbnail_url, duration_seconds, air_date, is_premium, is_published))`,
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) fail("anime", error);
  if (!data) return null;

  const description = localizedDescription(locale, data);
  const seasons: SeasonData[] = (data.seasons ?? [])
    .map((season) => ({
      id: season.id,
      number: season.number,
      title: localizedField(locale, { ru: season.title_ru, en: season.title_en, ja: season.title_ja }),
      episodes: (season.episodes ?? [])
        .filter((episode) => episode.is_published)
        .map((episode) => ({
          id: episode.id,
          number: episode.number,
          title: localizedField(locale, { ru: episode.title_ru, en: episode.title_en, ja: episode.title_ja }),
          thumbnailUrl: episode.thumbnail_url,
          durationSeconds: episode.duration_seconds,
          airDate: episode.air_date,
          isPremium: episode.is_premium,
        }))
        .sort((a, b) => a.number - b.number),
    }))
    .filter((season) => season.episodes.length > 0)
    .sort((a, b) => a.number - b.number);

  return {
    ...toCard(locale, data),
    titleRomaji: data.title_romaji,
    titleEnglish: data.title_english,
    titleNative: data.title_native,
    titleRu: data.anime_translations?.find((row) => row.locale === "ru")?.title ?? null,
    description: description.text,
    descriptionIsFallback: description.isFallback,
    season: data.season,
    startDate: data.start_date,
    endDate: data.end_date,
    episodeDuration: data.episode_duration,
    viewsCount: data.views_count,
    studio: data.studio,
    source: data.source,
    trailerYoutubeId: data.trailer_youtube_id,
    genres: (data.anime_genres ?? [])
      .map((row) => row.genres)
      .filter((genre): genre is NonNullable<typeof genre> => Boolean(genre))
      .map((genre) => ({
        id: genre.id,
        slug: genre.slug,
        name: localizedField(locale, { ru: genre.name_ru, en: genre.name_en, ja: genre.name_ja }),
      })),
    seasons,
    updatedAt: data.updated_at,
  };
}

/** Похожие аниме по пересечению жанров. */
export async function getSimilarAnime(animeId: string, genreSlugs: string[], locale: Locale, limit = 12): Promise<AnimeCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.anime);
  if (!isSupabaseConfigured || genreSlugs.length === 0) return [];

  const { data, error } = await getPublicClient()
    .from("anime")
    .select(CARD_COLUMNS)
    .eq("is_published", true)
    .eq("is_adult", false)
    .neq("id", animeId)
    .overlaps("genre_slugs", genreSlugs)
    .order("popularity", { ascending: false })
    .limit(60);
  if (error) fail("similar", error);

  const wanted = new Set(genreSlugs);
  return (data ?? [])
    .map((row) => ({ row, overlap: row.genre_slugs.filter((genre) => wanted.has(genre)).length }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map(({ row }) => toCard(locale, row));
}

/** Слайды главного баннера: управляемые баннеры, иначе — избранные или трендовые тайтлы. */
export async function getHeroSlides(locale: Locale): Promise<HeroSlide[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.banners, CACHE_TAGS.anime);
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getPublicClient()
    .from("banners")
    .select(
      `id, title_ru, title_en, title_ja, subtitle_ru, subtitle_en, subtitle_ja, image_url, link_url, starts_at, ends_at,
       anime (${CARD_WITH_DESCRIPTION})`,
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(8);
  if (error) fail("banners", error);

  const now = Date.now();
  const slides: HeroSlide[] = [];
  for (const banner of data ?? []) {
    if (banner.starts_at && new Date(banner.starts_at).getTime() > now) continue;
    if (banner.ends_at && new Date(banner.ends_at).getTime() <= now) continue;
    const anime = banner.anime && banner.anime.is_published ? banner.anime : null;
    if (banner.anime && !anime) continue;
    const card = anime ? toCard(locale, anime) : null;
    const title =
      localizedField(locale, { ru: banner.title_ru, en: banner.title_en, ja: banner.title_ja }) || card?.title || "";
    if (!title) continue;
    const subtitle =
      localizedField(locale, { ru: banner.subtitle_ru, en: banner.subtitle_en, ja: banner.subtitle_ja }) ||
      (anime ? localizedDescription(locale, anime).text : null);
    slides.push({
      id: banner.id,
      title,
      subtitle,
      imageUrl: banner.image_url ?? card?.bannerUrl ?? null,
      posterUrl: card?.posterUrl ?? null,
      href: banner.link_url ?? (card ? `/anime/${card.slug}` : "/catalog"),
      anime: card,
    });
  }
  if (slides.length > 0) return slides;

  // Запасной вариант: избранные тайтлы, затем трендовые с широким баннером.
  const { data: fallback, error: fallbackError } = await getPublicClient()
    .from("anime")
    .select(CARD_WITH_DESCRIPTION)
    .eq("is_published", true)
    .eq("is_adult", false)
    .not("banner_url", "is", null)
    .order("is_featured", { ascending: false })
    .order("trending", { ascending: false })
    .order("popularity", { ascending: false })
    .limit(5);
  if (fallbackError) fail("hero", fallbackError);

  return (fallback ?? []).map((row) => {
    const card = toCard(locale, row);
    return {
      id: row.id,
      title: card.title,
      subtitle: localizedDescription(locale, row).text,
      imageUrl: card.bannerUrl,
      posterUrl: card.posterUrl,
      href: `/anime/${card.slug}`,
      anime: card,
    };
  });
}

export async function getLatestEpisodes(locale: Locale, limit = 12): Promise<LatestEpisode[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.episodes, CACHE_TAGS.anime);
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getPublicClient()
    .from("episodes")
    .select(
      `id, number, title_ru, title_en, title_ja, thumbnail_url, is_premium, created_at,
       seasons!inner (number),
       anime!inner (slug, title_romaji, title_english, title_native, poster_url, banner_url, is_published, is_adult,
         anime_translations (locale, title))`,
    )
    .eq("is_published", true)
    .eq("anime.is_published", true)
    .eq("anime.is_adult", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("latest-episodes", error);

  return (data ?? []).map((row) => ({
    id: row.id,
    number: row.number,
    seasonNumber: row.seasons.number,
    title: localizedField(locale, { ru: row.title_ru, en: row.title_en, ja: row.title_ja }),
    thumbnailUrl: row.thumbnail_url,
    isPremium: row.is_premium,
    createdAt: row.created_at,
    anime: {
      slug: row.anime.slug,
      title: localizedTitle(locale, row.anime),
      posterUrl: row.anime.poster_url,
      bannerUrl: row.anime.banner_url,
    },
  }));
}

function toNews(
  locale: Locale,
  row: {
    id: string;
    slug: string;
    title_ru: string;
    title_en: string | null;
    title_ja: string | null;
    body_ru: string;
    body_en: string | null;
    body_ja: string | null;
    cover_url: string | null;
    published_at: string | null;
  },
): NewsItem {
  const own = locale === "ru" ? row.body_ru : locale === "en" ? row.body_en : row.body_ja;
  return {
    id: row.id,
    slug: row.slug,
    title: localizedField(locale, { ru: row.title_ru, en: row.title_en, ja: row.title_ja }),
    body: localizedField(locale, { ru: row.body_ru, en: row.body_en, ja: row.body_ja }),
    isFallback: !own?.trim(),
    coverUrl: row.cover_url,
    publishedAt: row.published_at,
  };
}

const NEWS_COLUMNS = "id, slug, title_ru, title_en, title_ja, body_ru, body_en, body_ja, cover_url, published_at" as const;

export async function getNews(locale: Locale, limit = 20): Promise<NewsItem[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.news);
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getPublicClient()
    .from("announcements")
    .select(NEWS_COLUMNS)
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) fail("news", error);
  return (data ?? []).map((row) => toNews(locale, row));
}

export async function getNewsBySlug(slug: string, locale: Locale): Promise<NewsItem | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.news);
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getPublicClient()
    .from("announcements")
    .select(NEWS_COLUMNS)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) fail("news-item", error);
  return data ? toNews(locale, data) : null;
}

export async function getPlans(locale: Locale): Promise<PlanData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.plans);
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getPublicClient()
    .from("plans")
    .select("id, name_ru, name_en, name_ja, price_cents, currency, billing_period")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) fail("plans", error);
  return (data ?? []).map((plan) => ({
    id: plan.id,
    name: localizedField(locale, { ru: plan.name_ru, en: plan.name_en, ja: plan.name_ja }),
    priceCents: plan.price_cents,
    currency: plan.currency,
    billingPeriod: plan.billing_period,
  }));
}

export type PublicSettings = {
  siteName: string;
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  contactEmail: string;
};

export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);
  const defaults: PublicSettings = {
    siteName: "ANIMEVERSE",
    registrationEnabled: true,
    maintenanceMode: false,
    contactEmail: "",
  };
  if (!isSupabaseConfigured) return defaults;

  const { data, error } = await getPublicClient().from("site_settings").select("key, value").eq("is_public", true);
  if (error) fail("settings", error);
  const map = new Map((data ?? []).map((row) => [row.key, row.value]));
  return {
    siteName: typeof map.get("site_name") === "string" ? (map.get("site_name") as string) : defaults.siteName,
    registrationEnabled: map.get("registration_enabled") !== false,
    maintenanceMode: map.get("maintenance_mode") === true,
    contactEmail: typeof map.get("contact_email") === "string" ? (map.get("contact_email") as string) : "",
  };
}

/** Слаги для sitemap. */
export async function getSitemapEntries(): Promise<{ anime: { slug: string; updatedAt: string }[]; news: { slug: string; updatedAt: string }[] }> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.anime, CACHE_TAGS.news);
  if (!isSupabaseConfigured) return { anime: [], news: [] };

  const client = getPublicClient();
  const [anime, news] = await Promise.all([
    client
      .from("anime")
      .select("slug, updated_at")
      .eq("is_published", true)
      .eq("is_adult", false)
      .order("popularity", { ascending: false })
      .limit(5000),
    client.from("announcements").select("slug, updated_at").eq("is_published", true).limit(1000),
  ]);
  return {
    anime: (anime.data ?? []).map((row) => ({ slug: row.slug, updatedAt: row.updated_at })),
    news: (news.data ?? []).map((row) => ({ slug: row.slug, updatedAt: row.updated_at })),
  };
}

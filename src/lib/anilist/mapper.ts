import { descriptionToParagraphs } from "@/lib/data/localize";
import type { AnimeFormat, AnimeSeasonName, AnimeStatus } from "@/lib/data/types";
import { slugify } from "@/lib/slug";
import type { AniListFuzzyDate, AniListMedia } from "./types";

const FORMAT_MAP: Record<string, AnimeFormat> = {
  TV: "tv",
  TV_SHORT: "tv_short",
  MOVIE: "movie",
  SPECIAL: "special",
  OVA: "ova",
  ONA: "ona",
  MUSIC: "music",
};

const STATUS_MAP: Record<string, AnimeStatus> = {
  FINISHED: "finished",
  RELEASING: "ongoing",
  NOT_YET_RELEASED: "announced",
  CANCELLED: "cancelled",
  HIATUS: "hiatus",
};

const SEASON_MAP: Record<string, AnimeSeasonName> = {
  WINTER: "winter",
  SPRING: "spring",
  SUMMER: "summer",
  FALL: "fall",
};

/** Жанры AniList, которые не импортируются в каталог. */
const EXCLUDED_GENRES = new Set(["hentai"]);

export type MappedAnime = {
  anilist_id: number;
  mal_id: number | null;
  title_romaji: string;
  title_english: string | null;
  title_native: string | null;
  synonyms: string[];
  description: string | null;
  format: AnimeFormat;
  status: AnimeStatus;
  season: AnimeSeasonName | null;
  season_year: number | null;
  start_date: string | null;
  end_date: string | null;
  episodes_total: number | null;
  episode_duration: number | null;
  score: number | null;
  popularity: number;
  trending: number;
  poster_url: string | null;
  poster_color: string | null;
  banner_url: string | null;
  trailer_youtube_id: string | null;
  studio: string | null;
  source: string | null;
  country: string | null;
  is_adult: boolean;
};

export type MappedMedia = {
  anime: MappedAnime;
  /** Жанры: slug и исходное английское название. */
  genres: { slug: string; name: string }[];
  slugBase: string;
};

function clip(value: string | null | undefined, max: number): string | null {
  const text = value?.trim();
  return text ? text.slice(0, max) : null;
}

export function fuzzyDateToIso(date: AniListFuzzyDate): string | null {
  if (!date?.year) return null;
  const month = date.month && date.month >= 1 && date.month <= 12 ? date.month : 1;
  const day = date.day && date.day >= 1 && date.day <= 31 ? date.day : 1;
  const iso = `${String(date.year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function httpsUrl(value: string | null | undefined): string | null {
  return value && /^https:\/\//.test(value) ? value : null;
}

/** Преобразует запись AniList в поля таблицы anime. */
export function mapMedia(media: AniListMedia): MappedMedia {
  const romaji = clip(media.title.romaji, 300) ?? clip(media.title.english, 300) ?? clip(media.title.native, 300) ?? `Anime ${media.id}`;
  const startDate = fuzzyDateToIso(media.startDate);
  const endDate = fuzzyDateToIso(media.endDate);
  const year = media.seasonYear ?? media.startDate?.year ?? null;
  const score = media.averageScore ?? media.meanScore;
  const description = descriptionToParagraphs(media.description).join("\n\n") || null;
  const trailerId =
    media.trailer?.site === "youtube" && media.trailer.id && /^[A-Za-z0-9_-]{6,20}$/.test(media.trailer.id)
      ? media.trailer.id
      : null;

  const genres = [...new Set(media.genres ?? [])]
    .map((name) => ({ slug: slugify(name), name: name.trim() }))
    .filter((genre) => genre.slug && !EXCLUDED_GENRES.has(genre.slug));

  return {
    anime: {
      anilist_id: media.id,
      mal_id: media.idMal && media.idMal > 0 ? media.idMal : null,
      title_romaji: romaji,
      title_english: clip(media.title.english, 300),
      title_native: clip(media.title.native, 300),
      synonyms: (media.synonyms ?? [])
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.length <= 200)
        .slice(0, 12),
      description,
      format: (media.format && FORMAT_MAP[media.format]) || "tv",
      status: (media.status && STATUS_MAP[media.status]) || "announced",
      season: (media.season && SEASON_MAP[media.season]) || null,
      season_year: year && year >= 1900 && year <= 2100 ? year : null,
      start_date: startDate,
      end_date: endDate && startDate && endDate < startDate ? null : endDate,
      episodes_total: media.episodes && media.episodes > 0 ? media.episodes : null,
      episode_duration: media.duration && media.duration > 0 ? media.duration : null,
      score: typeof score === "number" && score > 0 ? Math.min(10, Math.round(score) / 10) : null,
      popularity: Math.max(0, media.popularity ?? 0),
      trending: Math.max(0, media.trending ?? 0),
      poster_url: httpsUrl(media.coverImage?.extraLarge) ?? httpsUrl(media.coverImage?.large),
      poster_color: media.coverImage?.color && /^#[0-9a-fA-F]{6}$/.test(media.coverImage.color) ? media.coverImage.color : null,
      banner_url: httpsUrl(media.bannerImage),
      trailer_youtube_id: trailerId,
      studio: clip(media.studios?.nodes?.[0]?.name, 120),
      source: clip(media.source?.toLowerCase().replace(/_/g, " "), 60),
      country: media.countryOfOrigin && /^[A-Za-z]{2}$/.test(media.countryOfOrigin) ? media.countryOfOrigin.toUpperCase() : null,
      is_adult: Boolean(media.isAdult),
    },
    genres,
    slugBase: slugify(romaji) || `anime-${media.id}`,
  };
}

/** Поля anime, которые обновляет синхронизация (если не заблокированы вручную). */
export const SYNCABLE_FIELDS = [
  "mal_id", "title_romaji", "title_english", "title_native", "synonyms", "description", "format", "status",
  "season", "season_year", "start_date", "end_date", "episodes_total", "episode_duration", "score", "popularity",
  "trending", "poster_url", "poster_color", "banner_url", "trailer_youtube_id", "studio", "source", "country", "is_adult",
] as const satisfies readonly (keyof MappedAnime)[];

export type SyncableField = (typeof SYNCABLE_FIELDS)[number];

/**
 * Изменения для существующей записи: заблокированные вручную поля пропускаются,
 * если не запрошена принудительная синхронизация.
 */
export function buildSyncPatch(mapped: MappedAnime, lockedFields: string[], force = false): Partial<MappedAnime> {
  const locked = new Set(force ? [] : lockedFields);
  const patch: Partial<MappedAnime> = {};
  for (const field of SYNCABLE_FIELDS) {
    if (locked.has(field)) continue;
    (patch as Record<string, unknown>)[field] = mapped[field];
  }
  return patch;
}

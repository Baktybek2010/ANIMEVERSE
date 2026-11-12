import type { Enums } from "@/lib/supabase/types";

export type AnimeFormat = Enums<"anime_format">;
export type AnimeStatus = Enums<"anime_status">;
export type AnimeSeasonName = Enums<"anime_season_name">;

export const ANIME_FORMATS: AnimeFormat[] = ["tv", "tv_short", "movie", "ova", "ona", "special", "music"];
export const ANIME_STATUSES: AnimeStatus[] = ["announced", "ongoing", "finished", "hiatus", "cancelled"];
export const ANIME_SEASONS: AnimeSeasonName[] = ["winter", "spring", "summer", "fall"];

export type AnimeCardData = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  posterColor: string | null;
  bannerUrl: string | null;
  score: number | null;
  year: number | null;
  format: AnimeFormat;
  status: AnimeStatus;
  episodesTotal: number | null;
  isAdult: boolean;
  genreSlugs: string[];
};

export type GenreData = { id: number; slug: string; name: string };

export type EpisodeListItem = {
  id: string;
  number: number;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  airDate: string | null;
  isPremium: boolean;
};

export type SeasonData = {
  id: string;
  number: number;
  title: string;
  episodes: EpisodeListItem[];
};

export type AnimeDetail = AnimeCardData & {
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
  titleRu: string | null;
  description: string | null;
  descriptionIsFallback: boolean;
  season: AnimeSeasonName | null;
  startDate: string | null;
  endDate: string | null;
  episodeDuration: number | null;
  viewsCount: number;
  studio: string | null;
  source: string | null;
  trailerYoutubeId: string | null;
  genres: GenreData[];
  seasons: SeasonData[];
  updatedAt: string;
};

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  posterUrl: string | null;
  href: string;
  anime: AnimeCardData | null;
};

export type LatestEpisode = {
  id: string;
  number: number;
  seasonNumber: number;
  title: string;
  thumbnailUrl: string | null;
  isPremium: boolean;
  createdAt: string;
  anime: { slug: string; title: string; posterUrl: string | null; bannerUrl: string | null };
};

export type NewsItem = {
  id: string;
  slug: string;
  title: string;
  body: string;
  isFallback: boolean;
  coverUrl: string | null;
  publishedAt: string | null;
};

export type PlanData = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  billingPeriod: "month" | "year";
};

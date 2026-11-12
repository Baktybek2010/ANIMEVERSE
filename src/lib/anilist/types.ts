export type AniListFuzzyDate = { year: number | null; month: number | null; day: number | null } | null;

export type AniListMedia = {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[] | null;
  description: string | null;
  format: "TV" | "TV_SHORT" | "MOVIE" | "SPECIAL" | "OVA" | "ONA" | "MUSIC" | string | null;
  status: "FINISHED" | "RELEASING" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS" | string | null;
  season: "WINTER" | "SPRING" | "SUMMER" | "FALL" | null;
  seasonYear: number | null;
  startDate: AniListFuzzyDate;
  endDate: AniListFuzzyDate;
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  trending: number | null;
  genres: string[] | null;
  isAdult: boolean | null;
  countryOfOrigin: string | null;
  source: string | null;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null } | null;
  bannerImage: string | null;
  trailer: { id: string | null; site: string | null } | null;
  studios: { nodes: { name: string }[] } | null;
};

export type AniListPageInfo = {
  total: number | null;
  currentPage: number | null;
  lastPage: number | null;
  hasNextPage: boolean | null;
  perPage: number | null;
};

export type AniListPage = { pageInfo: AniListPageInfo; media: AniListMedia[] };

export type AniListSort = "POPULARITY_DESC" | "TRENDING_DESC" | "SCORE_DESC" | "START_DATE_DESC" | "SEARCH_MATCH";

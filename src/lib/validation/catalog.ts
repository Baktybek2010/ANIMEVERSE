import { ANIME_FORMATS, ANIME_SEASONS, ANIME_STATUSES, type AnimeFormat, type AnimeSeasonName, type AnimeStatus } from "@/lib/data/types";
import { SLUG_PATTERN } from "@/lib/slug";
import { normalizeQuery } from "@/lib/utils";

export const CATALOG_SORTS = ["popularity", "score", "newest", "title", "added"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export type CatalogFilters = {
  q: string;
  genres: string[];
  year: number | null;
  season: AnimeSeasonName | null;
  format: AnimeFormat | null;
  status: AnimeStatus | null;
  sort: CatalogSort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Разбор и нормализация параметров каталога из строки запроса. Невалидные значения отбрасываются. */
export function parseCatalogFilters(params: RawParams): CatalogFilters {
  const genresRaw = Array.isArray(params.genre) ? params.genre.join(",") : (params.genre ?? "");
  const genres = [...new Set(genresRaw.split(",").map((slug) => slug.trim().toLowerCase()))]
    .filter((slug) => slug.length <= 40 && SLUG_PATTERN.test(slug))
    .slice(0, 6)
    .sort();

  const yearValue = Number.parseInt(first(params.year) ?? "", 10);
  const pageValue = Number.parseInt(first(params.page) ?? "", 10);

  return {
    q: normalizeQuery(first(params.q)),
    genres,
    year: Number.isInteger(yearValue) && yearValue >= 1900 && yearValue <= 2100 ? yearValue : null,
    season: oneOf(first(params.season), ANIME_SEASONS),
    format: oneOf(first(params.format), ANIME_FORMATS),
    status: oneOf(first(params.status), ANIME_STATUSES),
    sort: oneOf(first(params.sort), CATALOG_SORTS) ?? "popularity",
    page: Number.isInteger(pageValue) && pageValue >= 1 && pageValue <= 500 ? pageValue : 1,
  };
}

/** Параметры строки запроса для текущих фильтров (без значений по умолчанию). */
export function catalogFiltersToQuery(filters: Partial<CatalogFilters>): Record<string, string | undefined> {
  return {
    q: filters.q || undefined,
    genre: filters.genres?.length ? filters.genres.join(",") : undefined,
    year: filters.year ? String(filters.year) : undefined,
    season: filters.season ?? undefined,
    format: filters.format ?? undefined,
    status: filters.status ?? undefined,
    sort: filters.sort && filters.sort !== "popularity" ? filters.sort : undefined,
  };
}

export function countActiveFilters(filters: CatalogFilters): number {
  return (
    filters.genres.length +
    (filters.year ? 1 : 0) +
    (filters.season ? 1 : 0) +
    (filters.format ? 1 : 0) +
    (filters.status ? 1 : 0)
  );
}

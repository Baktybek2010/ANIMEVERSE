"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { localizePath } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { plural } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ANIME_FORMATS, ANIME_SEASONS, ANIME_STATUSES, type GenreData } from "@/lib/data/types";
import { cn, normalizeQuery } from "@/lib/utils";
import { CATALOG_SORTS, type CatalogFilters, catalogFiltersToQuery, countActiveFilters } from "@/lib/validation/catalog";

type Props = {
  filters: CatalogFilters;
  genres: GenreData[];
  years: number[];
};

export function CatalogFiltersPanel({ filters, genres, years }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q);
  const [syncedQuery, setSyncedQuery] = useState(filters.q);
  const [expanded, setExpanded] = useState(false);
  // Адресная строка изменилась извне (кнопки «назад/вперёд», сброс) — обновляем поле.
  if (syncedQuery !== filters.q) {
    setSyncedQuery(filters.q);
    setQuery(filters.q);
  }
  const activeCount = countActiveFilters(filters);

  const navigate = (next: Partial<CatalogFilters>) => {
    const params = new URLSearchParams();
    // Любое изменение фильтра возвращает на первую страницу.
    for (const [key, value] of Object.entries(catalogFiltersToQuery({ ...filters, ...next }))) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(`${localizePath(locale, "/catalog")}${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  };

  // Поиск применяется с небольшой задержкой после ввода.
  useEffect(() => {
    const normalized = normalizeQuery(query);
    if (normalized === filters.q) return;
    const timer = window.setTimeout(() => navigate({ q: normalized }), 350);
    return () => window.clearTimeout(timer);
    // navigate зависит от текущих filters; пересоздавать таймер при их смене не нужно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters.q]);

  const toggleGenre = (slug: string) => {
    const set = new Set(filters.genres);
    if (set.has(slug)) set.delete(slug);
    else if (set.size < 6) set.add(slug);
    navigate({ genres: [...set].sort() });
  };

  const reset = () => {
    setQuery("");
    startTransition(() => router.push(localizePath(locale, "/catalog"), { scroll: false }));
  };

  return (
    <div className={cn("rounded-2xl border border-line bg-surface/70 p-4 transition-opacity sm:p-5", pending && "opacity-70")} aria-busy={pending}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-dim" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.catalog.searchPlaceholder}
            aria-label={t.search.label}
            maxLength={80}
            className="pl-10 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t.common.reset}
              className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-white/10 hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Select
            aria-label={t.catalog.sort}
            value={filters.sort}
            onChange={(event) => navigate({ sort: event.target.value as CatalogFilters["sort"] })}
            className="min-w-48 flex-1 sm:flex-none"
          >
            {CATALOG_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {
                  {
                    popularity: t.catalog.sortPopularity,
                    score: t.catalog.sortScore,
                    newest: t.catalog.sortNewest,
                    title: t.catalog.sortTitle,
                    added: t.catalog.sortAdded,
                  }[sort]
                }
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            className="lg:hidden"
            aria-expanded={expanded}
            aria-controls="catalog-filters"
            onClick={() => setExpanded((value) => !value)}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t.catalog.filters}</span>
            {activeCount > 0 ? (
              <span className="grid size-5 place-items-center rounded-full bg-brand text-[0.7rem] font-semibold text-white">{activeCount}</span>
            ) : null}
          </Button>
        </div>
      </div>

      <div id="catalog-filters" className={cn("mt-4 flex-col gap-4 lg:flex", expanded ? "flex" : "hidden")}>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Select
            aria-label={t.catalog.year}
            value={filters.year ?? ""}
            onChange={(event) => navigate({ year: event.target.value ? Number(event.target.value) : null })}
          >
            <option value="">{t.catalog.anyYear}</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t.catalog.season}
            value={filters.season ?? ""}
            onChange={(event) => navigate({ season: (event.target.value || null) as CatalogFilters["season"] })}
          >
            <option value="">{t.catalog.anySeason}</option>
            {ANIME_SEASONS.map((season) => (
              <option key={season} value={season}>
                {t.seasons[season]}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t.catalog.format}
            value={filters.format ?? ""}
            onChange={(event) => navigate({ format: (event.target.value || null) as CatalogFilters["format"] })}
          >
            <option value="">{t.catalog.anyFormat}</option>
            {ANIME_FORMATS.map((format) => (
              <option key={format} value={format}>
                {t.formats[format]}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t.catalog.status}
            value={filters.status ?? ""}
            onChange={(event) => navigate({ status: (event.target.value || null) as CatalogFilters["status"] })}
          >
            <option value="">{t.catalog.anyStatus}</option>
            {ANIME_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t.statuses[status]}
              </option>
            ))}
          </Select>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-dim uppercase">{t.catalog.genre}</legend>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((genre) => {
              const active = filters.genres.includes(genre.slug);
              return (
                <button
                  key={genre.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleGenre(genre.slug)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "border-transparent bg-brand-gradient font-medium text-white"
                      : "border-line text-muted hover:border-brand-soft/50 hover:text-fg",
                  )}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        {activeCount > 0 || filters.q ? (
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="text-sm text-muted">{activeCount > 0 ? plural(locale, activeCount, t.catalog.activeFilters) : null}</p>
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="size-4" aria-hidden />
              {t.catalog.resetFilters}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

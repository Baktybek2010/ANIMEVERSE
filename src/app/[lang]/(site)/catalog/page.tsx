import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AnimeGrid, AnimeGridSkeleton } from "@/components/anime/anime-card";
import { CatalogFiltersPanel } from "@/components/catalog/catalog-filters";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { fmt, plural } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getCatalogYears, getGenres, searchCatalog } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";
import { catalogFiltersToQuery, parseCatalogFilters } from "@/lib/validation/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return pageMetadata({ locale, path: "/catalog", title: t.meta.catalogTitle, description: t.catalog.description });
}

async function CatalogContent({ searchParams }: Pick<PageProps<"/[lang]/catalog">, "searchParams">) {
  const [{ locale, t }, params] = await Promise.all([getI18n(), searchParams]);
  const filters = parseCatalogFilters(params);
  const [genres, years, result] = await Promise.all([getGenres(locale), getCatalogYears(), searchCatalog(filters, locale)]);

  return (
    <>
      <CatalogFiltersPanel filters={filters} genres={genres} years={years} />
      <p className="mt-6 mb-4 text-sm text-muted" role="status" aria-live="polite">
        {plural(locale, result.total, t.catalog.results)}
      </p>
      {result.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t.catalog.noResultsTitle}
          text={t.catalog.noResultsText}
          action={
            <ButtonLink href="/catalog" variant="secondary">
              {t.catalog.resetFilters}
            </ButtonLink>
          }
        />
      ) : (
        <>
          <AnimeGrid items={result.items} priorityCount={6} />
          <div className="mt-10">
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              basePath="/catalog"
              query={catalogFiltersToQuery(filters)}
              labels={{
                previous: t.common.previous,
                next: t.common.next,
                pageOf: fmt(t.common.pageOf, { page: result.page, total: result.totalPages }),
              }}
            />
          </div>
        </>
      )}
    </>
  );
}

function CatalogSkeleton() {
  return (
    <>
      <Skeleton className="h-28 w-full rounded-2xl lg:h-52" />
      <Skeleton className="mt-6 mb-4 h-5 w-32" />
      <AnimeGridSkeleton count={18} />
    </>
  );
}

export default async function CatalogPage({ searchParams }: PageProps<"/[lang]/catalog">) {
  const { t } = await getI18n();
  return (
    <div className="container-page py-8 sm:py-10">
      <PageHeader title={t.catalog.title} description={t.catalog.description} />
      <div className="mt-6">
        <Suspense fallback={<CatalogSkeleton />}>
          <CatalogContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

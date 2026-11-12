import { Clapperboard } from "lucide-react";
import { Suspense } from "react";
import { Hero } from "@/components/home/hero";
import { AnimeRowSkeleton } from "@/components/home/section";
import {
  ContinueWatchingSection,
  ForYouSection,
  GenresSection,
  LatestEpisodesSection,
  ListSection,
  NewsSection,
} from "@/components/home/sections";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState } from "@/components/ui/misc";
import { localizePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { getAnimeList, getHeroSlides } from "@/lib/data/catalog";
import { absoluteUrl, jsonLd } from "@/lib/seo";

/** Подсказка персоналу, когда каталог пуст. */
async function EmptyCatalogAction() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user || !can(user.role, "import.run")) {
    return null;
  }
  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <p className="text-sm text-muted">{t.home.emptyAdminHint}</p>
      <ButtonLink href="/admin/import">{t.home.openImport}</ButtonLink>
    </div>
  );
}

export default async function HomePage() {
  const { locale, t } = await getI18n();
  const [slides, popular] = await Promise.all([getHeroSlides(locale), getAnimeList("popular", locale)]);
  const common = { locale, t };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ANIMEVERSE",
    url: absoluteUrl(localizePath(locale, "/")),
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl(localizePath(locale, "/catalog"))}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  if (popular.length === 0) {
    return (
      <div className="container-page py-20">
        <EmptyState icon={Clapperboard} title={t.home.emptyTitle} text={t.home.emptyText} />
        <Suspense fallback={null}>
          <EmptyCatalogAction />
        </Suspense>
      </div>
    );
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <Hero slides={slides} />
      <div className="relative z-10 -mt-6 space-y-10 sm:space-y-14">
        <Suspense fallback={null}>
          <ContinueWatchingSection {...common} />
        </Suspense>
        <ListSection kind="popular" title={t.home.popular} href="/catalog?sort=popularity" priority {...common} />
        <ListSection kind="new" title={t.home.newReleases} href="/catalog?sort=newest" {...common} />
        <Suspense fallback={<AnimeRowSkeleton />}>
          <ForYouSection {...common} />
        </Suspense>
        <ListSection kind="airing" title={t.home.airing} href="/catalog?status=ongoing" {...common} />
        <LatestEpisodesSection {...common} />
        <ListSection kind="top" title={t.home.top} href="/catalog?sort=score" {...common} />
        <GenresSection {...common} />
        <ListSection kind="trending" title={t.home.recommended} {...common} />
        <NewsSection {...common} />
      </div>
    </>
  );
}

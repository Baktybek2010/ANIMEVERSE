import { CalendarDays, Clapperboard, Eye, Play, Star, Tv } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EpisodeList } from "@/components/anime/episode-list";
import { LibraryButtons } from "@/components/anime/library-buttons";
import { Trailer } from "@/components/anime/trailer";
import { AnimeRow } from "@/components/home/section";
import { ButtonLink, Link } from "@/components/ui/link";
import { Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, formatCompact, formatDate, plural } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAnimeBySlug, getSimilarAnime } from "@/lib/data/catalog";
import { type EpisodeProgress, getAnimeProgress, getLibraryState } from "@/lib/data/library";
import { descriptionToParagraphs } from "@/lib/data/localize";
import type { AnimeDetail } from "@/lib/data/types";
import { absoluteUrl, jsonLd, pageMetadata } from "@/lib/seo";
import { SLUG_PATTERN } from "@/lib/slug";

type Props = PageProps<"/[lang]/anime/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ locale, t }, { slug }] = await Promise.all([getI18n(), params]);
  const anime = SLUG_PATTERN.test(slug) ? await getAnimeBySlug(slug, locale) : null;
  if (!anime) return { title: t.pages.notFoundTitle, robots: { index: false } };
  const summary = descriptionToParagraphs(anime.description)[0]?.slice(0, 200);
  return pageMetadata({
    locale,
    path: `/anime/${anime.slug}`,
    title: anime.year ? `${anime.title} (${anime.year})` : anime.title,
    description: summary || fmt(t.meta.animeDescription, { title: anime.title }),
    image: anime.bannerUrl ?? anime.posterUrl,
    type: "video.tv_show",
  });
}

/** Пользовательские кнопки: главная CTA учитывает прогресс, списки — текущее состояние. */
async function UserActions({ anime, t }: { anime: AnimeDetail; t: Dictionary }) {
  const user = await getCurrentUser();
  const state = user ? await getLibraryState(anime.id) : { isFavorite: false, inWatchlist: false };
  const progress: Record<string, EpisodeProgress> = user ? await getAnimeProgress(anime.id) : {};

  const episodes = anime.seasons.flatMap((season) => season.episodes.map((episode) => ({ season: season.number, episode })));
  // Продолжаем с последней недосмотренной серии, иначе — со следующей после последней просмотренной.
  let target = episodes[0];
  let isContinue = false;
  const watched = episodes
    .filter((item) => progress[item.episode.id])
    .sort((a, b) => progress[b.episode.id].updatedAt.localeCompare(progress[a.episode.id].updatedAt));
  if (watched[0]) {
    const last = watched[0];
    const index = episodes.indexOf(last);
    target = progress[last.episode.id].completed ? (episodes[index + 1] ?? last) : last;
    isContinue = true;
  }

  return (
    <>
      {target ? (
        <ButtonLink href={`/watch/${anime.slug}/${target.season}/${target.episode.number}`} size="lg">
          <Play className="size-5 fill-current" aria-hidden />
          {isContinue ? fmt(t.anime.continue, { number: target.episode.number }) : t.anime.watch}
        </ButtonLink>
      ) : null}
      <LibraryButtons
        animeId={anime.id}
        slug={anime.slug}
        isAuthenticated={Boolean(user)}
        initialFavorite={state.isFavorite}
        initialWatchlist={state.inWatchlist}
      />
    </>
  );
}

function ActionsFallback({ anime, t }: { anime: AnimeDetail; t: Dictionary }) {
  const first = anime.seasons[0]?.episodes[0];
  return (
    <>
      {first ? (
        <ButtonLink href={`/watch/${anime.slug}/${anime.seasons[0].number}/${first.number}`} size="lg">
          <Play className="size-5 fill-current" aria-hidden />
          {t.anime.watch}
        </ButtonLink>
      ) : null}
      <Skeleton className="h-13 w-44 rounded-xl" />
      <Skeleton className="h-13 w-48 rounded-xl" />
    </>
  );
}

async function EpisodesWithProgress({ anime }: { anime: AnimeDetail }) {
  const progress = await getAnimeProgress(anime.id);
  return <EpisodeList slug={anime.slug} seasons={anime.seasons} progress={progress} fallbackImage={anime.bannerUrl ?? anime.posterUrl} />;
}

async function Similar({ anime, locale, t }: { anime: AnimeDetail; locale: Locale; t: Dictionary }) {
  const items = await getSimilarAnime(anime.id, anime.genreSlugs, locale);
  return <AnimeRow id="similar" title={t.anime.similar} items={items} />;
}

async function AnimeContent({ params }: Pick<Props, "params">) {
  const [{ locale, t }, { slug }] = await Promise.all([getI18n(), params]);
  if (!SLUG_PATTERN.test(slug)) notFound();
  const anime = await getAnimeBySlug(slug, locale);
  if (!anime) notFound();

  const paragraphs = descriptionToParagraphs(anime.description);
  const episodeCount = anime.seasons.reduce((sum, season) => sum + season.episodes.length, 0);
  const titles = [
    { label: t.anime.titleRu, value: anime.titleRu, lang: "ru" },
    { label: t.anime.titleEn, value: anime.titleEnglish, lang: "en" },
    { label: t.anime.titleJa, value: anime.titleNative, lang: "ja" },
    { label: t.anime.titleRomaji, value: anime.titleRomaji, lang: "ja-Latn" },
  ].filter((item) => item.value);

  const facts = [
    { label: t.anime.format, value: t.formats[anime.format] },
    { label: t.anime.status, value: t.statuses[anime.status] },
    {
      label: t.anime.season,
      value: anime.season && anime.year ? `${t.seasons[anime.season]} ${anime.year}` : anime.year ? String(anime.year) : null,
    },
    { label: t.anime.episodes, value: anime.episodesTotal ? plural(locale, anime.episodesTotal, t.anime.episodesCount) : null },
    { label: t.anime.duration, value: anime.episodeDuration ? fmt(t.anime.minutes, { count: anime.episodeDuration }) : null },
    { label: t.anime.studio, value: anime.studio },
    { label: t.anime.source, value: anime.source },
  ].filter((item) => item.value);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": anime.format === "movie" ? "Movie" : "TVSeries",
    name: anime.title,
    alternateName: [anime.titleRomaji, anime.titleEnglish, anime.titleNative].filter((value) => value && value !== anime.title),
    url: absoluteUrl(`/${locale}/anime/${anime.slug}`),
    image: anime.posterUrl ?? undefined,
    description: paragraphs[0],
    genre: anime.genres.map((genre) => genre.name),
    inLanguage: "ja",
    datePublished: anime.startDate ?? undefined,
    numberOfEpisodes: anime.episodesTotal ?? undefined,
    productionCompany: anime.studio ? { "@type": "Organization", name: anime.studio } : undefined,
    aggregateRating: anime.score
      ? { "@type": "AggregateRating", ratingValue: anime.score, bestRating: 10, worstRating: 0, ratingCount: Math.max(1, anime.viewsCount) }
      : undefined,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />

      <div className="relative isolate -mt-16 pt-16">
        <div className="absolute inset-x-0 top-0 -z-10 h-[26rem] overflow-hidden sm:h-[30rem]">
          {anime.bannerUrl ? (
            <Image src={anime.bannerUrl} alt="" fill priority sizes="100vw" className="object-cover object-[center_25%]" />
          ) : anime.posterUrl ? (
            <Image src={anime.posterUrl} alt="" fill priority sizes="100vw" className="scale-125 object-cover opacity-70 blur-3xl" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-night via-night/75 to-night/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-night/90 via-night/30 to-transparent" />
        </div>

        <div className="container-page pt-28 sm:pt-40">
          <div className="flex flex-col gap-6 md:flex-row md:gap-10">
            <div className="mx-auto w-44 shrink-0 sm:w-56 md:mx-0 lg:w-64">
              <div
                className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-elevated shadow-card ring-1 ring-white/10"
                style={anime.posterColor ? { backgroundColor: anime.posterColor } : undefined}
              >
                {anime.posterUrl ? (
                  <Image src={anime.posterUrl} alt={anime.title} fill priority sizes="(min-width: 1024px) 256px, 224px" className="object-cover" />
                ) : null}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">{anime.title}</h1>
              {anime.titleNative && anime.titleNative !== anime.title ? (
                <p lang="ja" className="mt-2 text-base text-muted sm:text-lg">
                  {anime.titleNative}
                </p>
              ) : null}

              <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg/90">
                {anime.score ? (
                  <li className="flex items-center gap-1.5 text-base font-semibold text-gold" title={t.anime.score}>
                    <Star className="size-5 fill-current" aria-hidden />
                    {anime.score.toFixed(1)}
                    <span className="sr-only">{t.anime.score}</span>
                  </li>
                ) : null}
                {anime.year ? (
                  <li className="flex items-center gap-1.5">
                    <CalendarDays className="size-4 text-dim" aria-hidden />
                    {anime.year}
                  </li>
                ) : null}
                <li className="flex items-center gap-1.5">
                  <Tv className="size-4 text-dim" aria-hidden />
                  {t.formats[anime.format]}
                </li>
                {anime.viewsCount > 0 ? (
                  <li className="flex items-center gap-1.5" title={t.anime.views}>
                    <Eye className="size-4 text-dim" aria-hidden />
                    {formatCompact(locale, anime.viewsCount)}
                  </li>
                ) : null}
                <li>
                  <Badge tone={anime.status === "ongoing" ? "success" : anime.status === "announced" ? "sky" : "neutral"}>
                    {t.statuses[anime.status]}
                  </Badge>
                </li>
                {anime.isAdult ? (
                  <li>
                    <Badge tone="danger">{t.anime.adult}</Badge>
                  </li>
                ) : null}
              </ul>

              {anime.genres.length ? (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label={t.anime.genres}>
                  {anime.genres.map((genre) => (
                    <li key={genre.id}>
                      <Link
                        href={`/catalog?genre=${genre.slug}`}
                        className="rounded-full border border-line-strong bg-white/5 px-3 py-1 text-sm text-fg/90 transition-colors hover:border-brand-soft/60 hover:text-brand-soft"
                      >
                        {genre.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <Suspense fallback={<ActionsFallback anime={anime} t={t} />}>
                  <UserActions anime={anime} t={t} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="description-title">
            <h2 id="description-title" className="font-display text-xl font-semibold">
              {t.anime.description}
            </h2>
            {paragraphs.length ? (
              <div className="mt-3 space-y-3 text-[0.95rem] leading-relaxed text-muted" lang={anime.descriptionIsFallback ? "en" : undefined}>
                {paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-dim">{t.anime.noDescription}</p>
            )}
            {anime.descriptionIsFallback && paragraphs.length ? <p className="mt-3 text-xs text-dim">{t.anime.descriptionFallback}</p> : null}
          </section>

          <section aria-labelledby="episodes-title">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id="episodes-title" className="font-display text-xl font-semibold">
                {t.anime.seasonsAndEpisodes}
              </h2>
              {episodeCount > 0 ? <span className="text-sm text-dim">{plural(locale, episodeCount, t.anime.episodesCount)}</span> : null}
            </div>
            {episodeCount > 0 ? (
              <Suspense
                fallback={<EpisodeList slug={anime.slug} seasons={anime.seasons} fallbackImage={anime.bannerUrl ?? anime.posterUrl} />}
              >
                <EpisodesWithProgress anime={anime} />
              </Suspense>
            ) : (
              <EmptyState icon={Clapperboard} title={t.anime.noEpisodesTitle} text={t.anime.noEpisodesText} className="py-10" />
            )}
          </section>

          {anime.trailerYoutubeId ? (
            <section aria-labelledby="trailer-title">
              <h2 id="trailer-title" className="mb-4 font-display text-xl font-semibold">
                {t.anime.trailer}
              </h2>
              <Trailer youtubeId={anime.trailerYoutubeId} title={anime.title} />
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <dl className="divide-y divide-line rounded-2xl border border-line bg-surface/80 px-5">
            {titles.map((item) => (
              <div key={item.label} className="py-3">
                <dt className="text-xs text-dim">{item.label}</dt>
                <dd lang={item.lang} className="mt-0.5 text-sm font-medium">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <dl className="divide-y divide-line rounded-2xl border border-line bg-surface/80 px-5">
            {facts.map((item) => (
              <div key={item.label} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-sm text-dim">{item.label}</dt>
                <dd className="text-right text-sm font-medium capitalize">{item.value}</dd>
              </div>
            ))}
            {anime.startDate ? (
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-sm text-dim">{t.anime.year}</dt>
                <dd className="text-right text-sm font-medium">
                  <time dateTime={anime.startDate}>{formatDate(locale, anime.startDate)}</time>
                </dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>

      <div className="mt-14">
        <Similar anime={anime} locale={locale} t={t} />
      </div>
    </article>
  );
}

function AnimeSkeleton() {
  return (
    <div className="container-page pt-16 sm:pt-24" aria-hidden>
      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        <Skeleton className="mx-auto aspect-[2/3] w-44 rounded-2xl sm:w-56 md:mx-0 lg:w-64" />
        <div className="flex-1">
          <Skeleton className="h-11 w-3/4" />
          <Skeleton className="mt-3 h-5 w-1/3" />
          <Skeleton className="mt-6 h-5 w-2/3" />
          <div className="mt-6 flex gap-3">
            <Skeleton className="h-13 w-40 rounded-xl" />
            <Skeleton className="h-13 w-44 rounded-xl" />
          </div>
          <Skeleton className="mt-10 h-28 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function AnimePage({ params }: Props) {
  return (
    <Suspense fallback={<AnimeSkeleton />}>
      <AnimeContent params={params} />
    </Suspense>
  );
}

import { Newspaper } from "lucide-react";
import Image from "next/image";
import { Carousel } from "@/components/ui/carousel";
import { Link } from "@/components/ui/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, formatDate, formatDuration } from "@/i18n/format";
import { type AnimeListKind, getAnimeList, getGenres, getLatestEpisodes, getNews } from "@/lib/data/catalog";
import { getContinueWatching, getRecommendations } from "@/lib/data/library";
import { EpisodeCard } from "./episode-card";
import { AnimeRow, Section } from "./section";

type Common = { locale: Locale; t: Dictionary };

export async function ListSection({
  kind,
  title,
  href,
  locale,
  t,
  priority,
}: Common & { kind: AnimeListKind; title: string; href?: string; priority?: boolean }) {
  const items = await getAnimeList(kind, locale);
  return <AnimeRow id={`list-${kind}`} title={title} items={items} href={href} viewAllLabel={t.common.viewAll} priority={priority} />;
}

const GENRE_GRADIENTS = [
  "from-violet-600/70 to-indigo-900/60",
  "from-blue-600/70 to-cyan-900/60",
  "from-fuchsia-600/70 to-purple-900/60",
  "from-sky-600/70 to-blue-900/60",
  "from-indigo-600/70 to-violet-900/60",
  "from-purple-600/70 to-fuchsia-900/60",
];

export async function GenresSection({ locale, t }: Common) {
  const genres = await getGenres(locale);
  if (genres.length === 0) return null;
  return (
    <Section id="genres" title={t.home.genres} href="/catalog" viewAllLabel={t.common.viewAll}>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
        {genres.map((genre, index) => (
          <li key={genre.id}>
            <Link
              href={`/catalog?genre=${genre.slug}`}
              className={`group relative flex h-20 items-end overflow-hidden rounded-xl bg-gradient-to-br ${GENRE_GRADIENTS[index % GENRE_GRADIENTS.length]} p-3 ring-1 ring-white/10 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-glow`}
            >
              <span
                aria-hidden
                className="absolute -top-6 -right-4 size-20 rounded-full bg-white/10 blur-xl transition-transform duration-500 group-hover:scale-150"
              />
              <span className="relative text-sm leading-tight font-semibold">{genre.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export async function LatestEpisodesSection({ locale, t }: Common) {
  const episodes = await getLatestEpisodes(locale);
  if (episodes.length === 0) return null;
  return (
    <Section id="latest-episodes" title={t.home.latestEpisodes}>
      <Carousel label={t.home.latestEpisodes}>
        {episodes.map((episode) => (
          <EpisodeCard
            key={episode.id}
            href={`/watch/${episode.anime.slug}/${episode.seasonNumber}/${episode.number}`}
            title={episode.anime.title}
            subtitle={fmt(t.home.seasonEpisode, { season: episode.seasonNumber, episode: episode.number })}
            note={episode.title || undefined}
            imageUrl={episode.thumbnailUrl ?? episode.anime.bannerUrl ?? episode.anime.posterUrl}
            isPremium={episode.isPremium}
            premiumLabel={t.common.premium}
          />
        ))}
      </Carousel>
    </Section>
  );
}

/** Персональный блок: читает сессию, рендерится внутри <Suspense>. */
export async function ContinueWatchingSection({ locale, t }: Common) {
  const items = await getContinueWatching(locale);
  if (items.length === 0) return null;
  return (
    <Section id="continue" title={t.home.continueWatching} href="/account/history" viewAllLabel={t.nav.history}>
      <Carousel label={t.home.continueWatching}>
        {items.map((item) => {
          const remaining = Math.max(0, item.durationSeconds - item.positionSeconds);
          return (
            <EpisodeCard
              key={item.episodeId}
              href={`/watch/${item.anime.slug}/${item.seasonNumber}/${item.episodeNumber}`}
              title={item.anime.title}
              subtitle={fmt(t.home.seasonEpisode, { season: item.seasonNumber, episode: item.episodeNumber })}
              note={item.durationSeconds > 0 && item.positionSeconds > 0 ? fmt(t.home.resumeAt, { time: formatDuration(remaining) }) : undefined}
              imageUrl={item.thumbnailUrl ?? item.anime.bannerUrl ?? item.anime.posterUrl}
              progress={item.durationSeconds > 0 ? item.positionSeconds / item.durationSeconds : 0}
            />
          );
        })}
      </Carousel>
    </Section>
  );
}

export async function ForYouSection({ locale, t }: Common) {
  const items = await getRecommendations(locale);
  return <AnimeRow id="for-you" title={t.home.forYou} items={items} />;
}

export async function NewsSection({ locale, t }: Common) {
  const news = await getNews(locale, 3);
  if (news.length === 0) return null;
  return (
    <Section id="news" title={t.home.news} href="/news" viewAllLabel={t.common.viewAll}>
      <ul className="grid gap-4 md:grid-cols-3">
        {news.map((item) => (
          <li key={item.id}>
            <Link
              href={`/news/${item.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface/80 transition-[border-color,box-shadow] duration-300 hover:border-brand/50 hover:shadow-glow"
            >
              <div className="relative aspect-[16/8] bg-elevated">
                {item.coverUrl ? (
                  <Image src={item.coverUrl} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
                ) : (
                  <div className="bg-brand-gradient grid h-full place-items-center opacity-70">
                    <Newspaper className="size-9 text-white/80" aria-hidden />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                {item.publishedAt ? <time dateTime={item.publishedAt} className="text-xs text-dim">{formatDate(locale, item.publishedAt)}</time> : null}
                <h3 className="mt-1.5 line-clamp-2 font-semibold transition-colors group-hover:text-brand-soft">{item.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{item.body}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

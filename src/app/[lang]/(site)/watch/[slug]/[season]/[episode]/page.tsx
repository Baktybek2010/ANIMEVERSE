import { ChevronLeft, ChevronRight, Crown, VideoOff } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EpisodeList } from "@/components/anime/episode-list";
import { VideoPlayer } from "@/components/player/video-player";
import { ButtonLink, Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/misc";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAnimeBySlug } from "@/lib/data/catalog";
import { getAnimeProgress } from "@/lib/data/library";
import type { AnimeDetail, EpisodeListItem } from "@/lib/data/types";
import { getWatchAccess } from "@/lib/data/watch";
import { pageMetadata } from "@/lib/seo";
import { SLUG_PATTERN } from "@/lib/slug";

type Props = PageProps<"/[lang]/watch/[slug]/[season]/[episode]">;
type Resolved = {
  anime: AnimeDetail;
  seasonNumber: number;
  episode: EpisodeListItem;
  previous: { season: number; number: number } | null;
  next: { season: number; number: number } | null;
};

async function resolve(params: Props["params"], locale: Parameters<typeof getAnimeBySlug>[1]): Promise<Resolved | null> {
  const { slug, season, episode } = await params;
  const seasonNumber = Number.parseInt(season, 10);
  const episodeNumber = Number.parseInt(episode, 10);
  if (!SLUG_PATTERN.test(slug) || !/^\d{1,3}$/.test(season) || !/^\d{1,4}$/.test(episode)) return null;

  const anime = await getAnimeBySlug(slug, locale);
  if (!anime) return null;
  const flat = anime.seasons.flatMap((item) => item.episodes.map((entry) => ({ season: item.number, entry })));
  const index = flat.findIndex((item) => item.season === seasonNumber && item.entry.number === episodeNumber);
  if (index < 0) return null;

  const neighbour = (offset: number) => {
    const item = flat[index + offset];
    return item ? { season: item.season, number: item.entry.number } : null;
  };
  return { anime, seasonNumber, episode: flat[index].entry, previous: neighbour(-1), next: neighbour(1) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = await getI18n();
  const data = await resolve(params, locale);
  if (!data) return { title: t.pages.notFoundTitle, robots: { index: false } };
  return pageMetadata({
    locale,
    path: `/watch/${data.anime.slug}/${data.seasonNumber}/${data.episode.number}`,
    title: fmt(t.meta.watchTitle, { anime: data.anime.title, episode: data.episode.number }),
    description: data.episode.title || fmt(t.meta.animeDescription, { title: data.anime.title }),
    image: data.episode.thumbnailUrl ?? data.anime.bannerUrl ?? data.anime.posterUrl,
    type: "video.episode",
  });
}

function PlayerFrame({ poster, children }: { poster: string | null; children: React.ReactNode }) {
  return (
    <div className="relative grid aspect-video w-full place-items-center overflow-hidden bg-black sm:rounded-2xl">
      {poster ? <Image src={poster} alt="" fill sizes="(min-width: 1024px) 70vw, 100vw" className="object-cover opacity-25 blur-sm" /> : null}
      <div className="relative z-10 max-w-md p-6 text-center">{children}</div>
    </div>
  );
}

/** Плеер и доступ: зависит от сессии и подписки, поэтому рендерится на запрос. */
async function PlayerArea({ data, t }: { data: Resolved; t: Dictionary }) {
  const { anime, episode, seasonNumber, next } = data;
  const user = await getCurrentUser();
  const access = await getWatchAccess(episode, user);
  const poster = episode.thumbnailUrl ?? anime.bannerUrl ?? anime.posterUrl;
  const here = `/watch/${anime.slug}/${seasonNumber}/${episode.number}`;

  if (access.state === "premium") {
    return (
      <PlayerFrame poster={poster}>
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-gold/20 text-gold">
          <Crown className="size-7" aria-hidden />
        </div>
        <h2 className="font-display text-lg font-semibold sm:text-xl">{t.watch.premiumTitle}</h2>
        <p className="mt-2 text-sm text-muted">{t.watch.premiumText}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/premium" variant="gold">
            <Crown className="size-4" aria-hidden />
            {t.watch.getPremium}
          </ButtonLink>
          {!user ? (
            <ButtonLink href={`/login?next=${encodeURIComponent(here)}`} variant="secondary" prefetch={false}>
              {t.nav.login}
            </ButtonLink>
          ) : null}
        </div>
        {!user ? <p className="mt-3 text-xs text-dim">{t.watch.loginHint}</p> : null}
      </PlayerFrame>
    );
  }

  if (access.state === "no_sources") {
    return (
      <PlayerFrame poster={poster}>
        <VideoOff className="mx-auto size-11 text-muted" aria-hidden />
        <h2 className="mt-3 font-display text-lg font-semibold">{t.watch.noSourcesTitle}</h2>
        <p className="mt-2 text-sm text-muted">{t.watch.noSourcesText}</p>
      </PlayerFrame>
    );
  }

  return (
    <>
      <VideoPlayer
        key={episode.id}
        episodeId={episode.id}
        title={`${anime.title} — ${fmt(t.watch.episode, { number: episode.number })}`}
        poster={poster}
        sources={access.sources}
        subtitles={access.subtitles}
        startAt={access.startAt}
        nextHref={next ? `/watch/${anime.slug}/${next.season}/${next.number}` : null}
        canSaveProgress={Boolean(user)}
        preferences={{
          autoplayNext: user?.preferences.autoplayNext ?? true,
          audioLang: user?.preferences.audioLang ?? "",
          subtitleLang: user?.preferences.subtitleLang ?? "",
          // Качество по умолчанию — возможность Premium.
          quality: user?.isPremium ? (user.preferences.quality ?? "auto") : "auto",
        }}
      />
      <p className="mt-2 px-4 text-xs text-dim sm:px-0">{user ? t.watch.progressSaved : t.watch.loginToSave}</p>
    </>
  );
}

async function SidebarEpisodes({ data }: { data: Resolved }) {
  const progress = await getAnimeProgress(data.anime.id);
  return (
    <EpisodeList
      compact
      slug={data.anime.slug}
      seasons={data.anime.seasons}
      progress={progress}
      fallbackImage={data.anime.bannerUrl ?? data.anime.posterUrl}
      current={{ season: data.seasonNumber, episode: data.episode.number }}
    />
  );
}

async function WatchContent({ params }: Pick<Props, "params">) {
  const { locale, t } = await getI18n();
  const data = await resolve(params, locale);
  if (!data) notFound();
  const { anime, episode, seasonNumber, previous, next } = data;
  const fallbackList = (
    <EpisodeList
      compact
      slug={anime.slug}
      seasons={anime.seasons}
      fallbackImage={anime.bannerUrl ?? anime.posterUrl}
      current={{ season: seasonNumber, episode: episode.number }}
    />
  );

  return (
    <div className="mx-auto w-full max-w-[100rem] pb-10 sm:px-6 sm:pt-6 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          <Suspense fallback={<Skeleton className="aspect-video w-full rounded-none sm:rounded-2xl" />}>
            <PlayerArea data={data} t={t} />
          </Suspense>

          <div className="mt-5 px-4 sm:px-0">
            <Link href={`/anime/${anime.slug}`} className="inline-flex items-center gap-1 text-sm text-brand-soft hover:underline">
              <ChevronLeft className="size-4" aria-hidden />
              {t.watch.backToAnime}
            </Link>
            <h1 className="mt-2 font-display text-xl font-semibold tracking-tight sm:text-2xl">{anime.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {fmt(t.watch.season, { number: seasonNumber })} · {fmt(t.watch.episode, { number: episode.number })}
              {episode.title ? ` — ${episode.title}` : ""}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {previous ? (
                <ButtonLink href={`/watch/${anime.slug}/${previous.season}/${previous.number}`} variant="secondary" rel="prev">
                  <ChevronLeft className="size-4" aria-hidden />
                  {t.watch.prev}
                </ButtonLink>
              ) : null}
              {next ? (
                <ButtonLink href={`/watch/${anime.slug}/${next.season}/${next.number}`} variant="secondary" rel="next">
                  {t.watch.next}
                  <ChevronRight className="size-4" aria-hidden />
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="px-4 sm:px-0" aria-label={t.watch.episodes}>
          <h2 className="mb-3 font-display text-lg font-semibold">{t.watch.episodes}</h2>
          <div className="lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto lg:pr-1">
            <Suspense fallback={fallbackList}>
              <SidebarEpisodes data={data} />
            </Suspense>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function WatchPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[100rem] sm:px-6 sm:pt-6 lg:px-10" aria-hidden>
          <Skeleton className="aspect-video w-full rounded-none sm:rounded-2xl lg:w-[calc(100%-25.5rem)]" />
          <Skeleton className="mx-4 mt-5 h-7 w-2/3 sm:mx-0 sm:w-96" />
        </div>
      }
    >
      <WatchContent params={params} />
    </Suspense>
  );
}

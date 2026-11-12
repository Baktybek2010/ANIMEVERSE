"use client";

import { Check, Crown, Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDate, formatDuration } from "@/i18n/format";
import { Link } from "@/components/ui/link";
import type { EpisodeProgress } from "@/lib/data/library";
import type { SeasonData } from "@/lib/data/types";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  seasons: SeasonData[];
  progress?: Record<string, EpisodeProgress>;
  fallbackImage?: string | null;
  /** Номер сезона и серии, открытой сейчас в плеере. */
  current?: { season: number; episode: number };
  compact?: boolean;
};

/** Список сезонов и серий с отметками прогресса. */
export function EpisodeList({ slug, seasons, progress = {}, fallbackImage, current, compact = false }: Props) {
  const { t, locale } = useI18n();
  const [seasonNumber, setSeasonNumber] = useState(current?.season ?? seasons[0]?.number ?? 1);
  const season = seasons.find((item) => item.number === seasonNumber) ?? seasons[0];
  if (!season) return null;

  return (
    <div>
      {seasons.length > 1 ? (
        <div role="tablist" aria-label={t.anime.seasonsAndEpisodes} className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          {seasons.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.number === season.number}
              onClick={() => setSeasonNumber(item.number)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                item.number === season.number
                  ? "border-transparent bg-brand-gradient text-white"
                  : "border-line text-muted hover:border-brand-soft/50 hover:text-fg",
              )}
            >
              {item.title || fmt(t.anime.seasonN, { number: item.number })}
            </button>
          ))}
        </div>
      ) : null}

      <ol className={cn("grid gap-2.5", compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3")}>
        {season.episodes.map((episode) => {
          const state = progress[episode.id];
          const isCurrent = current?.season === season.number && current.episode === episode.number;
          const ratio = state && state.duration > 0 ? Math.min(1, state.position / state.duration) : 0;
          const image = episode.thumbnailUrl ?? fallbackImage;
          return (
            <li key={episode.id}>
              <Link
                href={`/watch/${slug}/${season.number}/${episode.number}`}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border p-2 transition-colors",
                  isCurrent ? "border-brand/70 bg-brand/15" : "border-line bg-white/[0.03] hover:border-brand-soft/40 hover:bg-white/[0.06]",
                )}
              >
                <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-elevated sm:w-32">
                  {image ? <Image src={image} alt="" fill sizes="128px" className="object-cover" /> : null}
                  <span className="absolute inset-0 grid place-items-center bg-night/35 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="size-6 fill-current text-white" aria-hidden />
                  </span>
                  {ratio > 0 ? (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20" aria-hidden>
                      <span className="bg-brand-gradient block h-full" style={{ width: `${Math.round((state?.completed ? 1 : ratio) * 100)}%` }} />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{fmt(t.anime.episodeN, { number: episode.number })}</span>
                    {episode.isPremium ? (
                      <span className="flex items-center gap-1 rounded bg-gold/15 px-1.5 py-0.5 text-[0.65rem] font-bold text-gold">
                        <Crown className="size-3" aria-hidden />
                        {t.common.premium}
                      </span>
                    ) : null}
                    {state?.completed ? (
                      <span className="flex items-center gap-0.5 text-[0.7rem] text-success" title={t.anime.watched}>
                        <Check className="size-3.5" aria-hidden />
                        <span className="sr-only">{t.anime.watched}</span>
                      </span>
                    ) : null}
                  </span>
                  {episode.title ? <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{episode.title}</span> : null}
                  <span className="mt-0.5 block text-xs text-dim">
                    {[episode.durationSeconds ? formatDuration(episode.durationSeconds) : null, episode.airDate ? formatDate(locale, episode.airDate, { day: "numeric", month: "short", year: "numeric" }) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

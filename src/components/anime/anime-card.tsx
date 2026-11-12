"use client";

import { Play, Star } from "lucide-react";
import Image from "next/image";
import { useI18n } from "@/i18n/client";
import { Link } from "@/components/ui/link";
import type { AnimeCardData } from "@/lib/data/types";
import { cn } from "@/lib/utils";

type AnimeCardProps = {
  anime: AnimeCardData;
  className?: string;
  /** Приоритетная загрузка для карточек первого экрана. */
  priority?: boolean;
  sizes?: string;
};

export function AnimeCard({ anime, className, priority = false, sizes }: AnimeCardProps) {
  const { t } = useI18n();
  const meta = [anime.year, t.formats[anime.format]].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/anime/${anime.slug}`}
      className={cn("group block rounded-card outline-offset-4", className)}
      aria-label={anime.title}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-card bg-elevated ring-1 ring-white/8 transition-[box-shadow,transform] duration-300 group-hover:-translate-y-1 group-hover:shadow-glow group-focus-visible:shadow-glow"
        style={anime.posterColor ? { backgroundColor: anime.posterColor } : undefined}
      >
        {anime.posterUrl ? (
          <Image
            src={anime.posterUrl}
            alt=""
            fill
            priority={priority}
            sizes={sizes ?? "(min-width: 1280px) 14vw, (min-width: 768px) 20vw, (min-width: 480px) 30vw, 45vw"}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center p-3 text-center font-display text-sm text-muted">{anime.title}</div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/95 via-night/10 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          {anime.score ? (
            <span className="glass flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-gold">
              <Star className="size-3 fill-current" aria-hidden />
              {anime.score.toFixed(1)}
            </span>
          ) : (
            <span />
          )}
          {anime.isAdult ? (
            <span className="rounded-md bg-danger/90 px-1.5 py-0.5 text-[0.65rem] font-bold text-white">{t.anime.adult}</span>
          ) : anime.status === "ongoing" ? (
            <span className="rounded-md bg-emerald-400/90 px-1.5 py-0.5 text-[0.65rem] font-bold text-night">
              {t.statuses.ongoing}
            </span>
          ) : null}
        </div>

        <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="bg-brand-gradient grid size-12 scale-90 place-items-center rounded-full text-white shadow-glow transition-transform duration-300 group-hover:scale-100">
            <Play className="size-5 translate-x-0.5 fill-current" aria-hidden />
          </span>
        </div>
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-2 text-sm leading-snug font-medium text-fg transition-colors group-hover:text-brand-soft">
          {anime.title}
        </h3>
        {meta ? <p className="mt-1 text-xs text-dim">{meta}</p> : null}
      </div>
    </Link>
  );
}

export function AnimeCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <div className="skeleton aspect-[2/3] rounded-card" />
      <div className="skeleton mt-2.5 h-4 w-4/5" />
      <div className="skeleton mt-1.5 h-3 w-2/5" />
    </div>
  );
}

export function AnimeGrid({ items, priorityCount = 0 }: { items: AnimeCardData[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 min-[480px]:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((anime, index) => (
        <li key={anime.id}>
          <AnimeCard anime={anime} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export function AnimeGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 min-[480px]:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }, (_, index) => (
        <AnimeCardSkeleton key={index} />
      ))}
    </div>
  );
}

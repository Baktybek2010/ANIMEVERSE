"use client";

import { Info, Play, Star } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { ButtonLink } from "@/components/ui/link";
import { descriptionToParagraphs } from "@/lib/data/localize";
import type { HeroSlide } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const ROTATE_MS = 8000;

export function Hero({ slides }: { slides: HeroSlide[] }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = slides[index] ?? slides[0];

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % slides.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, slides.length]);

  if (!slide) return null;
  const summary = descriptionToParagraphs(slide.subtitle)[0] ?? "";
  const anime = slide.anime;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t.home.heroBadge}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative isolate -mt-16 flex min-h-[34rem] items-end overflow-hidden pt-16 sm:min-h-[38rem] lg:min-h-[44rem]"
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="absolute inset-0 -z-10"
        >
          {slide.imageUrl ? (
            <Image src={slide.imageUrl} alt="" fill priority={index === 0} sizes="100vw" className="object-cover object-[center_20%]" />
          ) : slide.posterUrl ? (
            <Image src={slide.posterUrl} alt="" fill priority={index === 0} sizes="100vw" className="scale-110 object-cover blur-2xl" />
          ) : (
            <div className="bg-brand-gradient h-full opacity-40" />
          )}
        </motion.div>
      </AnimatePresence>

      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/70 to-night/20" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-night/95 via-night/45 to-transparent" />

      <div className="container-page pb-14 sm:pb-16 lg:pb-20">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl"
          aria-live="polite"
        >
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/15 px-3 py-1 text-xs font-semibold tracking-wide text-brand-soft uppercase backdrop-blur">
            <span className="size-1.5 rounded-full bg-brand-soft" aria-hidden />
            {t.home.heroBadge}
          </p>
          <h1 className="font-display text-3xl leading-[1.1] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {slide.title}
          </h1>
          {anime ? (
            <ul className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-fg/85">
              {anime.score ? (
                <li className="flex items-center gap-1 font-semibold text-gold">
                  <Star className="size-4 fill-current" aria-hidden />
                  {anime.score.toFixed(1)}
                </li>
              ) : null}
              {anime.year ? <li>{anime.year}</li> : null}
              <li>{t.formats[anime.format]}</li>
              <li className="rounded-md border border-line-strong px-1.5 py-0.5 text-xs">{t.statuses[anime.status]}</li>
            </ul>
          ) : null}
          {summary ? <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">{summary}</p> : null}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ButtonLink href={slide.href} size="lg">
              <Play className="size-5 fill-current" aria-hidden />
              {t.home.watchNow}
            </ButtonLink>
            {anime ? (
              <ButtonLink href={`/anime/${anime.slug}`} variant="secondary" size="lg">
                <Info className="size-5" aria-hidden />
                {t.home.details}
              </ButtonLink>
            ) : null}
          </div>
        </motion.div>

        {slides.length > 1 ? (
          <div className="mt-8 flex items-center gap-2" role="tablist" aria-label={t.home.heroBadge}>
            {slides.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={itemIndex === index}
                aria-label={item.title}
                onClick={() => setIndex(itemIndex)}
                className="group/dot grid h-6 place-items-center"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all duration-300",
                    itemIndex === index ? "bg-brand-gradient w-9" : "w-3 bg-white/30 group-hover/dot:bg-white/60",
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <div aria-hidden className="relative -mt-16 flex min-h-[34rem] items-end pt-16 sm:min-h-[38rem] lg:min-h-[44rem]">
      <div className="container-page pb-16">
        <div className="skeleton h-6 w-40 rounded-full" />
        <div className="skeleton mt-5 h-12 w-3/4 max-w-xl sm:h-16" />
        <div className="skeleton mt-5 h-4 w-full max-w-lg" />
        <div className="skeleton mt-2 h-4 w-2/3 max-w-md" />
        <div className="mt-7 flex gap-3">
          <div className="skeleton h-13 w-40 rounded-xl" />
          <div className="skeleton h-13 w-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

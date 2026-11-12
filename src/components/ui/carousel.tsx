"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Горизонтальная лента с прокруткой стрелками, колесом и свайпом. */
export function Carousel({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setEdges({
      start: track.scrollLeft <= 4,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    update();
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => observer.disconnect();
  }, [update]);

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.max(240, track.clientWidth * 0.85), behavior: "smooth" });
  };

  const arrow =
    "absolute top-[38%] z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-raised/90 text-fg shadow-card backdrop-blur transition-[opacity,background-color] hover:bg-elevated disabled:pointer-events-none disabled:opacity-0 md:grid";

  return (
    <div className={cn("group/carousel relative", className)}>
      <button type="button" aria-label={t.common.scrollLeft} onClick={() => scrollBy(-1)} disabled={edges.start} className={cn(arrow, "-left-4 opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100")}>
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <div
        ref={trackRef}
        onScroll={update}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="no-scrollbar -mx-4 flex snap-x snap-proximity scroll-px-4 gap-3 overflow-x-auto scroll-smooth px-4 pt-2 pb-2 sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 lg:-mx-10 lg:scroll-px-10 lg:px-10"
      >
        {children}
      </div>
      <button type="button" aria-label={t.common.scrollRight} onClick={() => scrollBy(1)} disabled={edges.end} className={cn(arrow, "-right-4 opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100")}>
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}

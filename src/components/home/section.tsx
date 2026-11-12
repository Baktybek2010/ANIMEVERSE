import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { AnimeCard, AnimeCardSkeleton } from "@/components/anime/anime-card";
import { Carousel } from "@/components/ui/carousel";
import { Link } from "@/components/ui/link";
import type { AnimeCardData } from "@/lib/data/types";

type SectionProps = {
  title: string;
  href?: string;
  viewAllLabel?: string;
  children: ReactNode;
  id?: string;
};

export function Section({ title, href, viewAllLabel, children, id }: SectionProps) {
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} className="container-page">
      <div className="mb-3 flex items-end justify-between gap-4 sm:mb-4">
        <h2 id={id ? `${id}-title` : undefined} className="font-display text-lg font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {href && viewAllLabel ? (
          <Link
            href={href}
            className="group flex shrink-0 items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-brand-soft"
          >
            {viewAllLabel}
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const ROW_ITEM = "w-[42vw] max-w-44 shrink-0 snap-start sm:w-44 lg:w-48 lg:max-w-48";

export function AnimeRow({
  id,
  title,
  items,
  href,
  viewAllLabel,
  priority = false,
}: {
  id: string;
  title: string;
  items: AnimeCardData[];
  href?: string;
  viewAllLabel?: string;
  priority?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <Section id={id} title={title} href={href} viewAllLabel={viewAllLabel}>
      <Carousel label={title}>
        {items.map((anime, index) => (
          <AnimeCard key={anime.id} anime={anime} className={ROW_ITEM} priority={priority && index < 5} sizes="(min-width: 1024px) 192px, (min-width: 640px) 176px, 42vw" />
        ))}
      </Carousel>
    </Section>
  );
}

export function AnimeRowSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="container-page" aria-hidden>
      <div className="skeleton mb-4 h-7 w-52" />
      <div className="flex gap-3 overflow-hidden sm:gap-4">
        {Array.from({ length: count }, (_, index) => (
          <AnimeCardSkeleton key={index} className={ROW_ITEM} />
        ))}
      </div>
    </div>
  );
}

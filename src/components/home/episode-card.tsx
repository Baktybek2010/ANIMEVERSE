import { Crown, Play } from "lucide-react";
import Image from "next/image";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";

type EpisodeCardProps = {
  href: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  /** Доля просмотра 0..1 — показывает полосу прогресса. */
  progress?: number;
  note?: string;
  isPremium?: boolean;
  premiumLabel?: string;
  className?: string;
};

/** Горизонтальная карточка серии (16:9) для лент «Продолжить просмотр» и «Новые серии». */
export function EpisodeCard({ href, title, subtitle, imageUrl, progress, note, isPremium, premiumLabel, className }: EpisodeCardProps) {
  return (
    <Link href={href} className={cn("group block w-[72vw] max-w-80 shrink-0 snap-start sm:w-80", className)} aria-label={`${title} — ${subtitle}`}>
      <div className="relative aspect-video overflow-hidden rounded-card bg-elevated ring-1 ring-white/8 transition-shadow duration-300 group-hover:shadow-glow group-focus-visible:shadow-glow">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 320px, 72vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/20 to-transparent" />
        {isPremium ? (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-gold px-1.5 py-0.5 text-[0.65rem] font-bold text-night">
            <Crown className="size-3" aria-hidden />
            {premiumLabel}
          </span>
        ) : null}
        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="bg-brand-gradient grid size-12 place-items-center rounded-full text-white shadow-glow">
            <Play className="size-5 translate-x-0.5 fill-current" aria-hidden />
          </span>
        </span>
        <div className="absolute inset-x-3 bottom-3">
          <p className="text-xs font-medium text-brand-soft">{subtitle}</p>
          {note ? <p className="mt-0.5 text-[0.7rem] text-fg/70">{note}</p> : null}
        </div>
        {typeof progress === "number" ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15" aria-hidden>
            <div className="bg-brand-gradient h-full" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
          </div>
        ) : null}
      </div>
      <h3 className="mt-2.5 line-clamp-1 px-0.5 text-sm font-medium transition-colors group-hover:text-brand-soft">{title}</h3>
    </Link>
  );
}

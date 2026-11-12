"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useI18n } from "@/i18n/client";

/** Официальный трейлер YouTube. Плеер подгружается только после клика (приватность и скорость). */
export function Trailer({ youtubeId, title }: { youtubeId: string; title: string }) {
  const { t } = useI18n();
  const [active, setActive] = useState(false);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-black">
      {active ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0`}
          title={`${t.anime.trailer}: ${title}`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full"
        />
      ) : (
        <button type="button" onClick={() => setActive(true)} className="group absolute inset-0 size-full" aria-label={`${t.anime.watchTrailer}: ${title}`}>
          <Image
            src={`https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`}
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover opacity-80 transition-opacity group-hover:opacity-100"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-night/80 to-transparent" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="bg-brand-gradient grid size-16 place-items-center rounded-full text-white shadow-glow transition-transform group-hover:scale-110">
              <Play className="size-7 translate-x-0.5 fill-current" aria-hidden />
            </span>
          </span>
          <span className="absolute bottom-4 left-4 text-sm font-medium">{t.anime.watchTrailer}</span>
        </button>
      )}
    </div>
  );
}

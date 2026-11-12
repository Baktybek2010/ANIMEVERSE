"use client";

import { Check, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDateTime } from "@/i18n/format";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Link } from "@/components/ui/link";
import { useToast } from "@/components/ui/toast";
import { clearHistoryAction, removeHistoryItemAction } from "@/lib/actions/library";
import type { HistoryItem } from "@/lib/data/library";

export function HistoryList({ items }: { items: HistoryItem[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const remove = (episodeId: string) => {
    setRemoved((current) => new Set(current).add(episodeId));
    startTransition(async () => {
      const result = await removeHistoryItemAction(episodeId);
      if (!result.ok) {
        setRemoved((current) => {
          const next = new Set(current);
          next.delete(episodeId);
          return next;
        });
        toast.error(t.errors[result.error]);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{t.account.history.title}</h1>
        <ConfirmButton
          title={t.account.history.clearAll}
          description={t.account.history.clearConfirm}
          confirmLabel={t.account.history.clearAll}
          onConfirm={async () => {
            const result = await clearHistoryAction();
            if (!result.ok) {
              toast.error(t.errors[result.error]);
              return;
            }
            toast.success(t.account.history.cleared);
            router.refresh();
          }}
        >
          {t.account.history.clearAll}
        </ConfirmButton>
      </div>
      <ul className="space-y-2.5">
        {items
          .filter((item) => !removed.has(item.episodeId))
          .map((item) => {
            const percent = item.completed ? 100 : item.durationSeconds > 0 ? Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100)) : 0;
            const image = item.thumbnailUrl ?? item.anime.bannerUrl ?? item.anime.posterUrl;
            return (
              <li key={item.episodeId} className="group relative flex items-center gap-4 rounded-2xl border border-line bg-surface/70 p-2.5 transition-colors hover:border-brand-soft/40">
                <Link href={`/watch/${item.anime.slug}/${item.seasonNumber}/${item.episodeNumber}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-xl">
                  <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-elevated sm:w-44">
                    {image ? <Image src={image} alt="" fill sizes="176px" className="object-cover" /> : null}
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20" aria-hidden>
                      <span className="bg-brand-gradient block h-full" style={{ width: `${percent}%` }} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 font-medium transition-colors group-hover:text-brand-soft">{item.anime.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {fmt(t.home.seasonEpisode, { season: item.seasonNumber, episode: item.episodeNumber })}
                      {item.episodeTitle ? ` — ${item.episodeTitle}` : ""}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-dim">
                      {item.completed ? (
                        <span className="flex items-center gap-1 text-success">
                          <Check className="size-3.5" aria-hidden />
                          {t.account.history.completed}
                        </span>
                      ) : (
                        <span>{fmt(t.account.history.progress, { percent })}</span>
                      )}
                      <time dateTime={item.updatedAt}>{formatDateTime(locale, item.updatedAt)}</time>
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(item.episodeId)}
                  aria-label={`${t.account.history.remove}: ${item.anime.title}`}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-dim transition-colors hover:bg-white/8 hover:text-danger"
                >
                  <X className="size-4.5" aria-hidden />
                </button>
              </li>
            );
          })}
      </ul>
    </>
  );
}

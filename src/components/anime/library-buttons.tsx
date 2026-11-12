"use client";

import { Bookmark, BookmarkCheck, Heart } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/link";
import { useToast } from "@/components/ui/toast";
import { toggleFavoriteAction, toggleWatchlistAction } from "@/lib/actions/library";
import { cn } from "@/lib/utils";

type Props = {
  animeId: string;
  slug: string;
  isAuthenticated: boolean;
  initialFavorite: boolean;
  initialWatchlist: boolean;
};

/** Кнопки «В избранное» и «Смотреть позже» с оптимистичным обновлением. */
export function LibraryButtons({ animeId, slug, isAuthenticated, initialFavorite, initialWatchlist }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(favorite);
  const [optimisticWatchlist, setOptimisticWatchlist] = useOptimistic(watchlist);
  const [pending, startTransition] = useTransition();

  if (!isAuthenticated) {
    const next = encodeURIComponent(`/anime/${slug}`);
    return (
      <>
        <ButtonLink href={`/login?next=${next}`} variant="secondary" size="lg" title={t.anime.loginToUse} prefetch={false}>
          <Heart className="size-5" aria-hidden />
          {t.anime.addFavorite}
        </ButtonLink>
        <ButtonLink href={`/login?next=${next}`} variant="secondary" size="lg" title={t.anime.loginToUse} prefetch={false}>
          <Bookmark className="size-5" aria-hidden />
          {t.anime.addWatchlist}
        </ButtonLink>
      </>
    );
  }

  const toggleFavorite = () =>
    startTransition(async () => {
      setOptimisticFavorite(!favorite);
      const result = await toggleFavoriteAction(animeId);
      if (!result.ok) {
        toast.error(t.errors[result.error]);
        return;
      }
      setFavorite(result.data.active);
      toast.success(result.data.active ? t.anime.addedFavorite : t.anime.removedFavorite);
    });

  const toggleWatchlist = () =>
    startTransition(async () => {
      setOptimisticWatchlist(!watchlist);
      const result = await toggleWatchlistAction(animeId);
      if (!result.ok) {
        toast.error(t.errors[result.error]);
        return;
      }
      setWatchlist(result.data.active);
      toast.success(result.data.active ? t.anime.addedWatchlist : t.anime.removedWatchlist);
    });

  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        aria-pressed={optimisticFavorite}
        disabled={pending}
        onClick={toggleFavorite}
        className={cn(optimisticFavorite && "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30")}
      >
        <Heart className={cn("size-5", optimisticFavorite && "fill-current")} aria-hidden />
        {optimisticFavorite ? t.anime.removeFavorite : t.anime.addFavorite}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        aria-pressed={optimisticWatchlist}
        disabled={pending}
        onClick={toggleWatchlist}
        className={cn(optimisticWatchlist && "bg-brand/25 text-brand-soft hover:bg-brand/35")}
      >
        {optimisticWatchlist ? <BookmarkCheck className="size-5" aria-hidden /> : <Bookmark className="size-5" aria-hidden />}
        {optimisticWatchlist ? t.anime.removeWatchlist : t.anime.addWatchlist}
      </Button>
    </>
  );
}

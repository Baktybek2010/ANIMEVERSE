import "server-only";

import type { Locale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { CARD_COLUMNS, toCard } from "./catalog";
import { localizedField, localizedTitle } from "./localize";
import type { AnimeCardData } from "./types";

export const LIBRARY_PAGE_SIZE = 36;

export type ContinueItem = {
  episodeId: string;
  episodeNumber: number;
  seasonNumber: number;
  positionSeconds: number;
  durationSeconds: number;
  thumbnailUrl: string | null;
  anime: { slug: string; title: string; posterUrl: string | null; bannerUrl: string | null };
};

export type HistoryItem = ContinueItem & { completed: boolean; updatedAt: string; episodeTitle: string };

export type EpisodeProgress = { position: number; duration: number; completed: boolean; updatedAt: string };

/** Количество непрочитанных уведомлений текущего пользователя. */
export async function getUnreadNotificationCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  return count ?? 0;
}

export async function getLibraryState(animeId: string): Promise<{ isFavorite: boolean; inWatchlist: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { isFavorite: false, inWatchlist: false };
  const supabase = await createClient();
  const [favorite, watch] = await Promise.all([
    supabase.from("favorites").select("anime_id").eq("user_id", user.id).eq("anime_id", animeId).maybeSingle(),
    supabase.from("watchlist").select("anime_id").eq("user_id", user.id).eq("anime_id", animeId).maybeSingle(),
  ]);
  return { isFavorite: Boolean(favorite.data), inWatchlist: Boolean(watch.data) };
}

/** Прогресс пользователя по сериям одного аниме: episodeId → состояние. */
export async function getAnimeProgress(animeId: string): Promise<Record<string, EpisodeProgress>> {
  const user = await getCurrentUser();
  if (!user) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("watch_history")
    .select("episode_id, position_seconds, duration_seconds, completed, updated_at")
    .eq("user_id", user.id)
    .eq("anime_id", animeId);
  const out: Record<string, EpisodeProgress> = {};
  for (const row of data ?? []) {
    out[row.episode_id] = {
      position: row.position_seconds,
      duration: row.duration_seconds,
      completed: row.completed,
      updatedAt: row.updated_at,
    };
  }
  return out;
}

const EPISODE_WITH_ANIME =
  "id, number, title_ru, title_en, title_ja, thumbnail_url, duration_seconds, seasons!inner (number), anime!inner (slug, title_romaji, title_english, title_native, poster_url, banner_url, anime_translations (locale, title))" as const;

export async function getContinueWatching(locale: Locale, limit = 12): Promise<ContinueItem[]> {
  const user = await getCurrentUser();
  if (!user || user.isBanned) return [];
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("get_continue_watching", { p_limit: limit });
  if (error || !rows?.length) return [];

  const { data: episodes } = await supabase
    .from("episodes")
    .select(EPISODE_WITH_ANIME)
    .in("id", rows.map((row) => row.episode_id));
  const byId = new Map((episodes ?? []).map((episode) => [episode.id, episode]));

  const items: ContinueItem[] = [];
  for (const row of rows) {
    const episode = byId.get(row.episode_id);
    if (!episode) continue;
    items.push({
      episodeId: episode.id,
      episodeNumber: episode.number,
      seasonNumber: episode.seasons.number,
      positionSeconds: row.position_seconds,
      durationSeconds: row.duration_seconds || episode.duration_seconds || 0,
      thumbnailUrl: episode.thumbnail_url,
      anime: {
        slug: episode.anime.slug,
        title: localizedTitle(locale, episode.anime),
        posterUrl: episode.anime.poster_url,
        bannerUrl: episode.anime.banner_url,
      },
    });
  }
  return items;
}

export async function getRecommendations(locale: Locale, limit = 18): Promise<AnimeCardData[]> {
  const user = await getCurrentUser();
  if (!user || user.isBanned) return [];
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("get_recommendations", { p_limit: limit });
  if (error || !rows?.length) return [];

  const { data } = await supabase
    .from("anime")
    .select(CARD_COLUMNS)
    .in("id", rows.map((row) => row.anime_id));
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  return rows.flatMap((row) => {
    const anime = byId.get(row.anime_id);
    return anime ? [toCard(locale, anime)] : [];
  });
}

type ListTable = "favorites" | "watchlist";

export async function getUserList(
  table: ListTable,
  locale: Locale,
  page = 1,
): Promise<{ items: AnimeCardData[]; total: number; totalPages: number }> {
  const user = await getCurrentUser();
  if (!user) return { items: [], total: 0, totalPages: 1 };
  const supabase = await createClient();
  const from = (page - 1) * LIBRARY_PAGE_SIZE;
  const { data, count } = await supabase
    .from(table)
    .select(`created_at, anime!inner (${CARD_COLUMNS})`, { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, from + LIBRARY_PAGE_SIZE - 1);
  const total = count ?? 0;
  return {
    items: (data ?? []).map((row) => toCard(locale, row.anime)),
    total,
    totalPages: Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE)),
  };
}

export async function getHistory(
  locale: Locale,
  page = 1,
): Promise<{ items: HistoryItem[]; total: number; totalPages: number }> {
  const user = await getCurrentUser();
  if (!user) return { items: [], total: 0, totalPages: 1 };
  const supabase = await createClient();
  const from = (page - 1) * LIBRARY_PAGE_SIZE;
  const { data, count } = await supabase
    .from("watch_history")
    .select(`position_seconds, duration_seconds, completed, updated_at, episodes!inner (${EPISODE_WITH_ANIME})`, { count: "exact" })
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .range(from, from + LIBRARY_PAGE_SIZE - 1);
  const total = count ?? 0;
  return {
    items: (data ?? []).map((row) => ({
      episodeId: row.episodes.id,
      episodeNumber: row.episodes.number,
      seasonNumber: row.episodes.seasons.number,
      episodeTitle: localizedField(locale, {
        ru: row.episodes.title_ru,
        en: row.episodes.title_en,
        ja: row.episodes.title_ja,
      }),
      positionSeconds: row.position_seconds,
      durationSeconds: row.duration_seconds || row.episodes.duration_seconds || 0,
      completed: row.completed,
      updatedAt: row.updated_at,
      thumbnailUrl: row.episodes.thumbnail_url,
      anime: {
        slug: row.episodes.anime.slug,
        title: localizedTitle(locale, row.episodes.anime),
        posterUrl: row.episodes.anime.poster_url,
        bannerUrl: row.episodes.anime.banner_url,
      },
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE)),
  };
}

export type NotificationItem = Pick<Tables<"notifications">, "id" | "type" | "title" | "body" | "link" | "read_at" | "created_at"> & {
  data: Record<string, string | number>;
};

export async function getNotifications(limit = 50): Promise<NotificationItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, data, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => {
    const params: Record<string, string | number> = {};
    if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
      for (const [key, value] of Object.entries(row.data)) {
        if (typeof value === "string" || typeof value === "number") params[key] = value;
      }
    }
    return { ...row, data: params };
  });
}

export type PaymentItem = Pick<
  Tables<"payments">,
  "id" | "amount_cents" | "currency" | "status" | "description" | "receipt_url" | "paid_at" | "created_at"
>;

export async function getPayments(limit = 50): Promise<PaymentItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, amount_cents, currency, status, description, receipt_url, paid_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

import "server-only";

import { can } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { PlayerSource, PlayerSubtitle } from "@/components/player/types";

export type WatchAccess = {
  /** premium — серия платная, а у пользователя нет действующей подписки. */
  state: "ok" | "premium" | "no_sources";
  sources: PlayerSource[];
  subtitles: PlayerSubtitle[];
  startAt: number;
};

/**
 * Источники видео для эпизода от имени текущего пользователя.
 * Доступ определяет RLS (функция can_watch_episode): для Premium-серии без подписки
 * база просто не вернёт ссылки на поток — проверка не зависит от кода клиента.
 */
export async function getWatchAccess(episode: { id: string; isPremium: boolean }, user: CurrentUser | null): Promise<WatchAccess> {
  const supabase = await createClient();
  const [sourcesResult, subtitlesResult, progressResult] = await Promise.all([
    supabase
      .from("episode_sources")
      .select("id, kind, url, quality, audio_lang, audio_label, is_default, sort_order")
      .eq("episode_id", episode.id)
      .order("sort_order", { ascending: true }),
    supabase.from("episode_subtitles").select("id, lang, label, url, is_default").eq("episode_id", episode.id),
    user
      ? supabase
          .from("watch_history")
          .select("position_seconds, completed")
          .eq("user_id", user.id)
          .eq("episode_id", episode.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const sources: PlayerSource[] = (sourcesResult.data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    url: row.url,
    quality: row.quality,
    audioLang: row.audio_lang,
    audioLabel: row.audio_label,
    isDefault: row.is_default,
  }));
  const subtitles: PlayerSubtitle[] = (subtitlesResult.data ?? []).map((row) => ({
    id: row.id,
    lang: row.lang,
    label: row.label,
    url: row.url,
    isDefault: row.is_default,
  }));

  const isStaff = Boolean(user && !user.isBanned && can(user.role, "content.manage"));
  const hasAccess = !episode.isPremium || Boolean(user?.isPremium) || isStaff;
  const progress = progressResult.data;

  return {
    state: !hasAccess ? "premium" : sources.length === 0 ? "no_sources" : "ok",
    sources: hasAccess ? sources : [],
    subtitles: hasAccess ? subtitles : [],
    startAt: progress && !progress.completed ? progress.position_seconds : 0,
  };
}

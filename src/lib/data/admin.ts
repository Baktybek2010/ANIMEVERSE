import "server-only";

import { isRole, type Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { escapeLike, normalizeQuery } from "@/lib/utils";

/**
 * Выборки админ-панели. Выполняются от имени текущего пользователя:
 * доступ к строкам ограничивают RLS-политики по уровню роли.
 */
export const ADMIN_PAGE_SIZE = 25;

function pageRange(page: number) {
  const from = (Math.max(1, page) - 1) * ADMIN_PAGE_SIZE;
  return [from, from + ADMIN_PAGE_SIZE - 1] as const;
}

export function parsePage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(typeof value === "string" ? value : "1", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 10000 ? parsed : 1;
}

export type DashboardStats = Record<
  | "users_total" | "users_new_7d" | "users_banned" | "premium_active" | "anime_total" | "anime_published"
  | "episodes_total" | "episodes_published" | "views_total" | "views_24h" | "views_7d" | "revenue_30d_cents",
  number
>;

export async function getDashboard() {
  const db = await createClient();
  const [stats, daily, users, logs] = await Promise.all([
    db.rpc("admin_dashboard_stats"),
    db.rpc("admin_daily_stats", { p_days: 30 }),
    db.from("profiles").select("id, username, display_name, avatar_url, email, created_at").order("created_at", { ascending: false }).limit(6),
    db
      .from("admin_logs")
      .select("id, action, entity_type, entity_id, created_at, actor:profiles!admin_logs_actor_id_fkey (username)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  return {
    stats: (stats.data ?? null) as DashboardStats | null,
    daily: daily.data ?? [],
    recentUsers: users.data ?? [],
    // Журнал виден только администраторам: для модератора RLS вернёт пустой список.
    recentLogs: logs.data ?? [],
  };
}

export async function getAdminAnimeList(options: { q?: string; filter?: string; page: number }) {
  const db = await createClient();
  const q = normalizeQuery(options.q);
  let query = db
    .from("anime")
    .select("id, slug, title_romaji, poster_url, format, status, season_year, is_published, is_featured, anilist_id, views_count, updated_at", { count: "exact" });
  if (q) query = query.or(`search_text.ilike.%${escapeLike(q.toLowerCase()).replace(/[,()"]/g, " ")}%,slug.ilike.%${escapeLike(q.toLowerCase()).replace(/[,()"]/g, " ")}%`);
  if (options.filter === "published") query = query.eq("is_published", true);
  if (options.filter === "drafts") query = query.eq("is_published", false);
  const [from, to] = pageRange(options.page);
  const { data, count } = await query.order("updated_at", { ascending: false }).range(from, to);
  return { items: data ?? [], total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / ADMIN_PAGE_SIZE)) };
}

export async function getAdminAnime(id: string) {
  const db = await createClient();
  const { data } = await db
    .from("anime")
    .select(
      `*, anime_translations (locale, title, description, is_manual), anime_genres (genre_id),
       seasons (id, number, title_ru, title_en, title_ja,
         episodes (id, number, title_ru, title_en, title_ja, description, thumbnail_url, duration_seconds, air_date, is_premium, is_published, views_count,
           episode_sources (id, kind, url, quality, audio_lang, audio_label, is_default),
           episode_subtitles (id, lang, label, url, is_default)))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const seasons = [...(data.seasons ?? [])]
    .sort((a, b) => a.number - b.number)
    .map((season) => ({ ...season, episodes: [...(season.episodes ?? [])].sort((a, b) => a.number - b.number) }));
  return { ...data, seasons };
}

export type AdminAnime = NonNullable<Awaited<ReturnType<typeof getAdminAnime>>>;
export type AdminSeason = AdminAnime["seasons"][number];
export type AdminEpisode = AdminSeason["episodes"][number];

export async function getAdminGenres() {
  const db = await createClient();
  const { data } = await db.from("genres").select("id, slug, name_ru, name_en, name_ja").order("name_en");
  return data ?? [];
}

export async function getAdminUsers(options: { q?: string; page: number }) {
  const db = await createClient();
  const q = normalizeQuery(options.q).replace(/[,()"]/g, " ");
  let query = db
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, email, role, is_banned, created_at, subscriptions!subscriptions_user_id_fkey (status, current_period_end)",
      { count: "exact" },
    );
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    query = query.or(`username.ilike.${pattern},display_name.ilike.${pattern},email.ilike.${pattern}`);
  }
  const [from, to] = pageRange(options.page);
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
  const now = Date.now();
  return {
    items: (data ?? []).map((row) => ({
      ...row,
      role: (isRole(row.role) ? row.role : "user") as Role,
      isPremium: (row.subscriptions ?? []).some(
        (sub) => (sub.status === "active" || sub.status === "trialing") && new Date(sub.current_period_end).getTime() > now,
      ),
    })),
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / ADMIN_PAGE_SIZE)),
  };
}

export async function getAdminUser(id: string) {
  const db = await createClient();
  const { data: profile } = await db
    .from("profiles")
    .select("id, username, display_name, avatar_url, email, bio, role, locale, is_banned, banned_reason, banned_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!profile) return null;
  const [subscriptions, payments, favorites, watchlist, history] = await Promise.all([
    db
      .from("subscriptions")
      .select("id, plan_id, status, provider, current_period_start, current_period_end, cancel_at_period_end, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    db.from("payments").select("id, amount_cents, currency, status, description, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
    db.from("favorites").select("anime_id", { count: "exact", head: true }).eq("user_id", id),
    db.from("watchlist").select("anime_id", { count: "exact", head: true }).eq("user_id", id),
    db.from("watch_history").select("episode_id", { count: "exact", head: true }).eq("user_id", id),
  ]);
  return {
    profile: { ...profile, role: (isRole(profile.role) ? profile.role : "user") as Role },
    subscriptions: subscriptions.data ?? [],
    payments: payments.data ?? [],
    // Счётчики недоступны через RLS (личные данные пользователя) — показываем только если база их вернула.
    counts: { favorites: favorites.count, watchlist: watchlist.count, history: history.count },
  };
}

export async function getAdminSubscriptions(options: { status?: string; page: number }) {
  const db = await createClient();
  const statuses = ["incomplete", "trialing", "active", "past_due", "canceled", "expired"] as const;
  let query = db
    .from("subscriptions")
    .select(
      "id, user_id, plan_id, status, provider, current_period_start, current_period_end, cancel_at_period_end, created_at, user:profiles!subscriptions_user_id_fkey (username, email)",
      { count: "exact" },
    );
  const status = statuses.find((item) => item === options.status);
  if (status) query = query.eq("status", status);
  const [from, to] = pageRange(options.page);
  const [{ data, count }, payments, plans] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, to),
    db
      .from("payments")
      .select("id, amount_cents, currency, status, description, created_at, user:profiles!payments_user_id_fkey (username)")
      .order("created_at", { ascending: false })
      .limit(15),
    db.from("plans").select("*").order("sort_order"),
  ]);
  return {
    items: data ?? [],
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / ADMIN_PAGE_SIZE)),
    payments: payments.data ?? [],
    plans: plans.data ?? [],
  };
}

export async function getAdminBanners() {
  const db = await createClient();
  const { data } = await db
    .from("banners")
    .select("*, anime (slug, title_romaji, banner_url, poster_url)")
    .order("sort_order")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type AdminBanner = Awaited<ReturnType<typeof getAdminBanners>>[number];

export async function getAdminNews(page: number) {
  const db = await createClient();
  const [from, to] = pageRange(page);
  const { data, count } = await db
    .from("announcements")
    .select("id, slug, title_ru, is_published, published_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  return { items: data ?? [], total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / ADMIN_PAGE_SIZE)) };
}

export async function getAdminNewsItem(id: string): Promise<Tables<"announcements"> | null> {
  const db = await createClient();
  const { data } = await db.from("announcements").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function getAdminSettings() {
  const db = await createClient();
  const { data } = await db.from("site_settings").select("key, value");
  const map = new Map((data ?? []).map((row) => [row.key, row.value]));
  const text = (key: string, fallback = "") => (typeof map.get(key) === "string" ? (map.get(key) as string) : fallback);
  return {
    site_name: text("site_name", "ANIMEVERSE"),
    contact_email: text("contact_email"),
    registration_enabled: map.get("registration_enabled") !== false,
    maintenance_mode: map.get("maintenance_mode") === true,
    anilist_auto_sync: map.get("anilist_auto_sync") !== false,
    anilist_sync_batch: typeof map.get("anilist_sync_batch") === "number" ? (map.get("anilist_sync_batch") as number) : 20,
  };
}

export async function getAdminLogs(page: number) {
  const db = await createClient();
  const [from, to] = pageRange(page);
  const { data, count } = await db
    .from("admin_logs")
    .select("id, action, entity_type, entity_id, details, created_at, actor:profiles!admin_logs_actor_id_fkey (username)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  return { items: data ?? [], total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / ADMIN_PAGE_SIZE)) };
}

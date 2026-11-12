import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { type Locale, localizePath } from "@/i18n/config";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { can, isRole, type Permission, type Role, roleLevel } from "./roles";
import { isSubscriptionActive } from "./subscription";

export type UserPreferences = {
  autoplayNext?: boolean;
  audioLang?: string;
  subtitleLang?: string;
  quality?: string;
  emailNotifications?: boolean;
};

export type CurrentSubscription = Pick<
  Tables<"subscriptions">,
  "id" | "plan_id" | "status" | "provider" | "current_period_start" | "current_period_end" | "cancel_at_period_end"
>;

export type CurrentUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  locale: string;
  role: Role;
  roleLevel: number;
  isBanned: boolean;
  bannedReason: string | null;
  isPremium: boolean;
  subscription: CurrentSubscription | null;
  preferences: UserPreferences;
  createdAt: string;
};

/**
 * Текущий пользователь: JWT проверяется сервером Auth, роль и подписка читаются из БД.
 * Данным из браузера доверия нет. Результат кешируется в пределах одного запроса.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      `id, email, username, display_name, avatar_url, bio, locale, role, is_banned, banned_reason, preferences, created_at,
       subscriptions!subscriptions_user_id_fkey (id, plan_id, status, provider, current_period_start, current_period_end, cancel_at_period_end)`,
    )
    .eq("id", userId)
    .in("subscriptions.status", ["trialing", "active", "past_due"])
    .maybeSingle();

  if (error || !profile) return null;

  const role: Role = isRole(profile.role) ? profile.role : "user";
  const subscription = profile.subscriptions?.[0] ?? null;
  const isBanned = profile.is_banned;

  return {
    id: profile.id,
    email: profile.email ?? (typeof claimsData.claims.email === "string" ? claimsData.claims.email : ""),
    username: profile.username,
    displayName: profile.display_name || profile.username,
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    locale: profile.locale,
    role,
    roleLevel: isBanned ? 0 : roleLevel(role),
    isBanned,
    bannedReason: profile.banned_reason,
    isPremium: !isBanned && isSubscriptionActive(subscription),
    subscription,
    preferences: (profile.preferences ?? {}) as UserPreferences,
    createdAt: profile.created_at,
  };
});

/** Требует авторизованного и не заблокированного пользователя, иначе редирект. */
export async function requireUser(locale: Locale, returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`${localizePath(locale, "/login")}${next}`);
  }
  if (user.isBanned) {
    redirect(localizePath(locale, "/banned"));
  }
  return user;
}

/** Требует право доступа; без него — редирект на главную (админ-маршруты не раскрываются). */
export async function requirePermission(locale: Locale, permission: Permission, returnTo?: string): Promise<CurrentUser> {
  const user = await requireUser(locale, returnTo);
  if (!can(user.role, permission)) {
    redirect(localizePath(locale, "/"));
  }
  return user;
}

"use server";

import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "./guard";
import { type ActionResult, fail, mapDbError, ok } from "./result";

const idSchema = z.uuid();

async function toggle(table: "favorites" | "watchlist", animeId: unknown): Promise<ActionResult<{ active: boolean }>> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const parsed = idSchema.safeParse(animeId);
  if (!parsed.success) return fail("validation");
  if (!(await rateLimit(`library.${table}`, user.id, 60, 60))) return fail("rateLimited");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from(table)
    .select("anime_id")
    .eq("user_id", user.id)
    .eq("anime_id", parsed.data)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id).eq("anime_id", parsed.data);
    if (error) return fail(mapDbError(error));
    return ok({ active: false });
  }
  const { error } = await supabase.from(table).insert({ user_id: user.id, anime_id: parsed.data });
  if (error && error.code !== "23505") {
    return fail(error.code === "23503" ? "notFound" : mapDbError(error));
  }
  return ok({ active: true });
}

export async function toggleFavoriteAction(animeId: unknown) {
  return toggle("favorites", animeId);
}

export async function toggleWatchlistAction(animeId: unknown) {
  return toggle("watchlist", animeId);
}

export async function removeHistoryItemAction(episodeId: unknown): Promise<ActionResult> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const parsed = idSchema.safeParse(episodeId);
  if (!parsed.success) return fail("validation");
  const supabase = await createClient();
  const { error } = await supabase.from("watch_history").delete().eq("user_id", user.id).eq("episode_id", parsed.data);
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function clearHistoryAction(): Promise<ActionResult> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("watch_history").delete().eq("user_id", user.id);
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function markNotificationReadAction(id: unknown): Promise<ActionResult> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return fail("validation");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("id", parsed.data)
    .is("read_at", null);
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function deleteNotificationAction(id: unknown): Promise<ActionResult> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return fail("validation");
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").delete().eq("user_id", user.id).eq("id", parsed.data);
  if (error) return fail(mapDbError(error));
  return ok();
}

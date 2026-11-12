"use server";

import { updateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/data/tags";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { bannerSchema, genreSchema, newsSchema, planSchema, settingsSchema, uuidSchema } from "@/lib/validation/admin";
import { z } from "zod";
import { authorize } from "../guard";
import { type ActionResult, fail, mapDbError, ok, validationFail } from "../result";
import { logAdmin } from "./shared";

const genreIdSchema = z.coerce.number().int().positive();

// ---------- Жанры ----------------------------------------------------------

export async function saveGenreAction(id: number | null, input: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  if (id !== null && !genreIdSchema.safeParse(id).success) return fail("validation");
  const parsed = genreSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const db = await createClient();
  const { error } = id ? await db.from("genres").update(parsed.data).eq("id", id) : await db.from("genres").insert(parsed.data);
  if (error) return fail(error.code === "23505" ? "duplicate" : mapDbError(error), error.code === "23505" ? { slug: "duplicate" } : undefined);
  await logAdmin(db, id ? "genre.update" : "genre.create", "genre", id ?? parsed.data.slug, { slug: parsed.data.slug });
  updateTag(CACHE_TAGS.genres);
  updateTag(CACHE_TAGS.anime);
  return ok();
}

export async function deleteGenreAction(id: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.delete");
  if (denied) return denied;
  const parsed = genreIdSchema.safeParse(id);
  if (!parsed.success) return fail("validation");
  const db = await createClient();
  const { error } = await db.from("genres").delete().eq("id", parsed.data);
  if (error) return fail(mapDbError(error));
  await logAdmin(db, "genre.delete", "genre", parsed.data);
  updateTag(CACHE_TAGS.genres);
  updateTag(CACHE_TAGS.anime);
  return ok();
}

// ---------- Баннеры --------------------------------------------------------

export async function saveBannerAction(id: string | null, input: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  if (id !== null && !uuidSchema.safeParse(id).success) return fail("validation");
  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { anime_slug, ...rest } = parsed.data;
  const db = await createClient();

  let animeId: string | null = null;
  if (anime_slug) {
    const { data: anime } = await db.from("anime").select("id").eq("slug", anime_slug).maybeSingle();
    if (!anime) return fail("notFound", { anime_slug: "notFound" });
    animeId = anime.id;
  }
  const row = { ...rest, anime_id: animeId };
  const { error } = id ? await db.from("banners").update(row).eq("id", id) : await db.from("banners").insert(row);
  if (error) return fail(mapDbError(error));
  await logAdmin(db, id ? "banner.update" : "banner.create", "banner", id, { anime: anime_slug || null });
  updateTag(CACHE_TAGS.banners);
  return ok();
}

export async function deleteBannerAction(id: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return fail("validation");
  const db = await createClient();
  const { error } = await db.from("banners").delete().eq("id", parsed.data);
  if (error) return fail(mapDbError(error));
  await logAdmin(db, "banner.delete", "banner", parsed.data);
  updateTag(CACHE_TAGS.banners);
  return ok();
}

// ---------- Новости --------------------------------------------------------

export async function saveNewsAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const { user, denied } = await authorize("content.manage");
  if (denied) return denied;
  if (id !== null && !uuidSchema.safeParse(id).success) return fail("validation");
  const parsed = newsSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const db = await createClient();
  const { slug: rawSlug, ...rest } = parsed.data;

  let publishedAt: string | null | undefined;
  let slug = rawSlug;
  if (id) {
    const { data: existing } = await db.from("announcements").select("slug, published_at").eq("id", id).maybeSingle();
    if (!existing) return fail("notFound");
    slug = rawSlug || existing.slug;
    publishedAt = rest.is_published ? (existing.published_at ?? new Date().toISOString()) : existing.published_at;
  } else {
    slug = rawSlug || slugify(rest.title_ru) || `news-${Date.now().toString(36)}`;
    publishedAt = rest.is_published ? new Date().toISOString() : null;
  }

  const row = { ...rest, slug, published_at: publishedAt };
  const result = id
    ? await db.from("announcements").update(row).eq("id", id).select("id").maybeSingle()
    : await db.from("announcements").insert({ ...row, author_id: user.id }).select("id").maybeSingle();
  if (result.error) {
    const duplicate = result.error.code === "23505";
    return fail(duplicate ? "duplicate" : mapDbError(result.error), duplicate ? { slug: "duplicate" } : undefined);
  }
  if (!result.data) return fail("notFound");
  await logAdmin(db, id ? "news.update" : "news.create", "news", result.data.id, { slug });
  updateTag(CACHE_TAGS.news);
  return ok({ id: result.data.id });
}

export async function deleteNewsAction(id: unknown): Promise<ActionResult> {
  const { denied } = await authorize("content.manage");
  if (denied) return denied;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return fail("validation");
  const db = await createClient();
  const { error } = await db.from("announcements").delete().eq("id", parsed.data);
  if (error) return fail(mapDbError(error));
  await logAdmin(db, "news.delete", "news", parsed.data);
  updateTag(CACHE_TAGS.news);
  return ok();
}

// ---------- Настройки и тарифы ---------------------------------------------

const PUBLIC_SETTINGS = new Set(["site_name", "contact_email", "registration_enabled", "maintenance_mode"]);

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  const { user, denied } = await authorize("settings.manage");
  if (denied) return denied;
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const db = await createClient();
  const rows = Object.entries(parsed.data).map(([key, value]) => ({
    key,
    value,
    is_public: PUBLIC_SETTINGS.has(key),
    updated_by: user.id,
  }));
  const { error } = await db.from("site_settings").upsert(rows, { onConflict: "key" });
  if (error) return fail(mapDbError(error));
  await logAdmin(db, "settings.update", "settings", null, {
    maintenance_mode: parsed.data.maintenance_mode,
    registration_enabled: parsed.data.registration_enabled,
  });
  updateTag(CACHE_TAGS.settings);
  return ok();
}

export async function savePlanAction(input: unknown): Promise<ActionResult> {
  const { denied } = await authorize("subscriptions.manage");
  if (denied) return denied;
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { id, ...rest } = parsed.data;
  const db = await createClient();
  const { data, error } = await db.from("plans").update(rest).eq("id", id).select("id").maybeSingle();
  if (error) return fail(mapDbError(error));
  if (!data) return fail("notFound");
  await logAdmin(db, "plan.update", "plan", id, { price_cents: rest.price_cents, currency: rest.currency, is_active: rest.is_active });
  updateTag(CACHE_TAGS.plans);
  return ok();
}

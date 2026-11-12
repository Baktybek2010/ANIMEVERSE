"use server";

import { hasLocale, type Locale } from "@/i18n/config";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { UPLOAD_LIMITS, validateImageUpload } from "@/lib/upload";
import { preferencesSchema, profileSchema } from "@/lib/validation/profile";
import { authorize } from "./guard";
import { type ActionResult, fail, mapDbError, ok, validationFail } from "./result";

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  if (!(await rateLimit("profile.update", user.id, 20, 600))) return fail("rateLimited");

  const supabase = await createClient();
  const { displayName, username, bio } = parsed.data;

  if (username.toLowerCase() !== user.username.toLowerCase()) {
    const { data: available } = await supabase.rpc("is_username_available", { p_username: username });
    if (available === false) return fail("usernameTaken", { username: "usernameTaken" });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, username, bio: bio || null })
    .eq("id", user.id);
  if (error) {
    if (error.code === "23505") return fail("usernameTaken", { username: "usernameTaken" });
    return fail(mapDbError(error));
  }
  return ok();
}

export async function uploadAvatarAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  if (!(await rateLimit("profile.avatar", user.id, 10, 600))) return fail("rateLimited");

  const check = await validateImageUpload(formData.get("file"), {
    maxBytes: UPLOAD_LIMITS.avatar,
    allowed: ["jpeg", "png", "webp"],
  });
  if (!check.ok) return fail(check.error);

  const supabase = await createClient();
  const path = `${user.id}/avatar-${Date.now()}.${check.extension}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, check.bytes, { contentType: check.mime, cacheControl: "31536000", upsert: false });
  if (uploadError) return fail("uploadFailed");

  const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl.publicUrl }).eq("id", user.id);
  if (error) {
    await supabase.storage.from("avatars").remove([path]);
    return fail(mapDbError(error));
  }

  // Удаляем предыдущие файлы аватара пользователя.
  const { data: existing } = await supabase.storage.from("avatars").list(user.id);
  const stale = (existing ?? []).map((file) => `${user.id}/${file.name}`).filter((name) => name !== path);
  if (stale.length) await supabase.storage.from("avatars").remove(stale);

  return ok({ url: publicUrl.publicUrl });
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return fail(mapDbError(error));
  const { data: existing } = await supabase.storage.from("avatars").list(user.id);
  if (existing?.length) {
    await supabase.storage.from("avatars").remove(existing.map((file) => `${user.id}/${file.name}`));
  }
  return ok();
}

export async function savePreferencesAction(input: unknown): Promise<ActionResult> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { locale, ...preferences } = parsed.data;

  // Выбор качества по умолчанию — возможность Premium; проверяется на сервере.
  if (!user.isPremium) preferences.quality = "auto";

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ locale, preferences: { ...user.preferences, ...preferences } })
    .eq("id", user.id);
  if (error) return fail(mapDbError(error));
  return ok();
}

/** Сохраняет язык интерфейса в профиле (для гостей — ничего не делает). */
export async function saveLocaleAction(locale: Locale): Promise<void> {
  if (!hasLocale(locale)) return;
  const { user } = await authorize();
  if (!user || user.locale === locale) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ locale }).eq("id", user.id);
}

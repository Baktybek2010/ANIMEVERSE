"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { hasLocale, type Locale, localizePath } from "@/i18n/config";
import { getPublicSettings } from "@/lib/data/catalog";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { rateLimit, rateLimitByIp } from "@/lib/rate-limit";
import { getRequestOrigin } from "@/lib/site-url";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";
import {
  changePasswordSchema,
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { authorize } from "./guard";
import { type ActionResult, type ErrorKey, fail, ok, validationFail } from "./result";

function mapAuthError(error: { message?: string; code?: string; status?: number }): ErrorKey {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) return "invalidCredentials";
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) return "emailNotConfirmed";
  if (code === "user_already_exists" || code === "email_exists" || message.includes("already registered")) return "emailTaken";
  if (code === "weak_password" || message.includes("password should")) return "weakPassword";
  if (code === "same_password" || message.includes("different from the old password")) return "samePassword";
  if (code === "user_banned" || message.includes("banned")) return "banned";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || error.status === 429) return "rateLimited";
  if (code === "signup_disabled") return "registrationDisabled";
  if (code === "session_not_found" || message.includes("session missing")) return "sessionExpired";
  return "generic";
}

export async function registerAction(input: unknown): Promise<ActionResult<{ needsConfirmation: boolean; email: string }>> {
  if (!isSupabaseConfigured) return fail("notConfigured");
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { username, email, password, locale } = parsed.data;

  if (!(await rateLimitByIp("auth.register", 6, 600))) return fail("rateLimited");

  const settings = await getPublicSettings();
  if (!settings.registrationEnabled) return fail("registrationDisabled");

  const supabase = await createClient();
  const { data: available } = await supabase.rpc("is_username_available", { p_username: username });
  if (available === false) return fail("usernameTaken", { username: "usernameTaken" });

  const origin = await getRequestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, locale },
      emailRedirectTo: `${origin}/api/auth/callback?flow=signup&next=${encodeURIComponent(localizePath(locale, "/"))}`,
    },
  });
  if (error) {
    const key = mapAuthError(error);
    return fail(key, key === "emailTaken" ? { email: "emailTaken" } : key === "weakPassword" ? { password: "weakPassword" } : undefined);
  }
  // При включённом подтверждении e-mail Supabase не раскрывает существующие адреса:
  // возвращается пользователь без identities.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return fail("emailTaken", { email: "emailTaken" });
  }
  return ok({ needsConfirmation: !data.session, email });
}

export async function loginAction(input: unknown, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  if (!isSupabaseConfigured) return fail("notConfigured");
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { email, password } = parsed.data;

  const [ipAllowed, emailAllowed] = await Promise.all([
    rateLimitByIp("auth.login", 20, 600),
    rateLimit("auth.login.email", email, 8, 600),
  ]);
  if (!ipAllowed || !emailAllowed) return fail("rateLimited");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return fail(mapAuthError(error ?? {}));

  const { data: profile } = await supabase.from("profiles").select("is_banned, locale").eq("id", data.user.id).maybeSingle();
  if (profile?.is_banned) {
    await supabase.auth.signOut();
    return fail("banned");
  }

  const locale: Locale = hasLocale(profile?.locale) ? profile.locale : "ru";
  return ok({ redirectTo: safeRedirectPath(next, localizePath(locale, "/")) });
}

export async function logoutAction(locale: Locale): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(`${localizePath(hasLocale(locale) ? locale : "ru", "/")}?notice=loggedOut`);
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("notConfigured");
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { email, locale } = parsed.data;

  const [ipAllowed, emailAllowed] = await Promise.all([
    rateLimitByIp("auth.forgot", 5, 900),
    rateLimit("auth.forgot.email", email, 3, 900),
  ]);
  if (!ipAllowed || !emailAllowed) return fail("rateLimited");

  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/api/auth/callback?flow=recovery&next=${encodeURIComponent(localizePath(locale, "/reset-password"))}`,
  });
  if (error && mapAuthError(error) === "rateLimited") return fail("rateLimited");
  // Всегда одинаковый ответ: не раскрываем, зарегистрирован ли адрес.
  return ok();
}

export async function resendConfirmationAction(emailInput: unknown, localeInput: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("notConfigured");
  const parsed = emailSchema.safeParse(emailInput);
  if (!parsed.success || typeof localeInput !== "string" || !hasLocale(localeInput)) return fail("validation");

  const [ipAllowed, emailAllowed] = await Promise.all([
    rateLimitByIp("auth.resend", 5, 900),
    rateLimit("auth.resend.email", parsed.data, 3, 900),
  ]);
  if (!ipAllowed || !emailAllowed) return fail("rateLimited");

  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback?flow=signup&next=${encodeURIComponent(localizePath(localeInput, "/"))}`,
    },
  });
  if (error && mapAuthError(error) === "rateLimited") return fail("rateLimited");
  return ok();
}

/** Установка нового пароля после перехода по ссылке восстановления (нужна сессия восстановления). */
export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("notConfigured");
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return fail("sessionExpired");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const key = mapAuthError(error);
    return fail(key, key === "weakPassword" || key === "samePassword" ? { password: key } : undefined);
  }
  return ok();
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  if (!(await rateLimit("auth.change_password", user.id, 5, 900))) return fail("rateLimited");

  // Текущий пароль проверяется отдельным клиентом без cookies, чтобы не трогать сессию.
  const verifier = createSupabaseClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) return fail("wrongPassword", { currentPassword: "wrongPassword" });

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const key = mapAuthError(error);
    return fail(key, key === "weakPassword" || key === "samePassword" ? { password: key } : undefined);
  }
  return ok();
}

export async function deleteAccountAction(confirmation: unknown, locale: Locale): Promise<ActionResult> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  if (typeof confirmation !== "string" || confirmation.trim() !== user.username) {
    return fail("confirmMismatch", { confirmation: "confirmMismatch" });
  }
  // Оплаченная подписка должна быть отменена у провайдера до удаления аккаунта.
  if (user.subscription && user.subscription.provider !== "manual" && !user.subscription.cancel_at_period_end) {
    return fail("alreadySubscribed");
  }
  const admin = getAdminClient();
  if (!admin) return fail("notConfigured");

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return fail("generic");

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`${localizePath(hasLocale(locale) ? locale : "ru", "/")}?notice=accountDeleted`);
}

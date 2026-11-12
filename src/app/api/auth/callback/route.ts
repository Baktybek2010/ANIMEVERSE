import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, hasLocale, splitLocale } from "@/i18n/config";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";

/**
 * Возврат из письма Supabase (подтверждение e-mail, восстановление пароля).
 * Обменивает одноразовый код на сессию (PKCE) и перенаправляет на страницу `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"), `/${defaultLocale}`);
  const locale = splitLocale(next).locale ?? defaultLocale;
  const flow = searchParams.get("flow") === "recovery" ? "recovery" : "signup";
  const code = searchParams.get("code");

  const to = (path: string, notice?: string) => {
    const url = new URL(path, origin);
    if (notice) url.searchParams.set("notice", notice);
    return NextResponse.redirect(url);
  };

  if (!isSupabaseConfigured) return to(`/${locale}`);

  // Supabase сообщает об ошибке ссылки параметрами error / error_code.
  if (searchParams.get("error") || !code) {
    return flow === "recovery" ? to(`/${locale}/forgot-password`, "resetLinkInvalid") : to(`/${locale}/login`, "confirmFailed");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Ссылку открыли в другом браузере: адрес уже подтверждён сервером Auth, но сессию создать нельзя.
    return flow === "recovery" ? to(`/${locale}/forgot-password`, "resetLinkInvalid") : to(`/${locale}/login`, "emailConfirmedLogin");
  }

  return flow === "recovery" ? to(next) : to(hasLocale(locale) ? next : `/${defaultLocale}`, "emailConfirmed");
}

import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, splitLocale } from "@/i18n/config";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Подтверждение по token_hash — для собственных шаблонов писем (см. supabase/templates).
 * В отличие от PKCE-кода работает, даже если письмо открыто в другом браузере.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fallbackNext = type === "recovery" ? `/${defaultLocale}/reset-password` : `/${defaultLocale}`;
  const next = safeRedirectPath(searchParams.get("next"), fallbackNext);
  const locale = splitLocale(next).locale ?? defaultLocale;

  const to = (path: string, notice?: string) => {
    const url = new URL(path, origin);
    if (notice) url.searchParams.set("notice", notice);
    return NextResponse.redirect(url);
  };

  if (!isSupabaseConfigured || !tokenHash || !type || !OTP_TYPES.includes(type)) {
    return to(`/${locale}/login`, "confirmFailed");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return type === "recovery" ? to(`/${locale}/forgot-password`, "resetLinkInvalid") : to(`/${locale}/login`, "confirmFailed");
  }
  return type === "recovery" ? to(next) : to(next, "emailConfirmed");
}

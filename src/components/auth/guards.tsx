import { redirect } from "next/navigation";
import { localizePath } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";

/** Авторизованных пользователей уводит со страниц входа и регистрации. Рендерится внутри <Suspense>. */
export async function RedirectIfAuthenticated() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  if (user && !user.isBanned) redirect(localizePath(locale, "/account"));
  return null;
}

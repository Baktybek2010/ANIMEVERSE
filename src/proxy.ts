import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, hasLocale, LOCALE_COOKIE, matchLocale, splitLocale } from "@/i18n/config";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Разделы, доступные только после входа (оптимистичная проверка; окончательная — на сервере страницы). */
const PROTECTED_PREFIXES = ["/account", "/admin"];

function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale, path } = splitLocale(pathname);

  // 1. Путь без локали → редирект на сохранённый или предпочитаемый язык.
  if (!locale) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const target = hasLocale(cookieLocale)
      ? cookieLocale
      : (matchLocale(request.headers.get("accept-language")) ?? defaultLocale);
    const url = request.nextUrl.clone();
    url.pathname = `/${target}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const authenticated = hasAuthCookie(request);

  // 2. Обновление сессии Supabase (только если есть cookie авторизации).
  let hasSession = false;
  if (authenticated && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    });
    try {
      const { data } = await supabase.auth.getClaims();
      hasSession = Boolean(data?.claims?.sub);
    } catch {
      hasSession = false;
    }
  }

  // 3. Закрытые разделы без сессии → страница входа.
  if (!hasSession && PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
    return redirectResponse;
  }

  // 4. Запоминаем выбранный язык между посещениями.
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Всё, кроме API, служебных файлов Next.js и статических ресурсов.
    "/((?!api/|_next/|sw\\.js|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|sitemap/|favicon\\.ico|icon|apple-icon|opengraph-image|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|txt|xml|json|webmanifest|vtt|mp4|m3u8|ts)$).*)",
  ],
};

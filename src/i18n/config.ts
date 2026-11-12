export const locales = ["ru", "en", "ja"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const localeNames: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
  ja: "日本語",
};

/** BCP 47-теги для Intl и атрибута lang. */
export const localeTags: Record<Locale, string> = {
  ru: "ru-RU",
  en: "en-US",
  ja: "ja-JP",
};

export const ogLocales: Record<Locale, string> = {
  ru: "ru_RU",
  en: "en_US",
  ja: "ja_JP",
};

export function hasLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Добавляет префикс локали к внутреннему пути: ("en", "/catalog") → "/en/catalog". */
export function localizePath(locale: Locale, path: string): string {
  if (!path.startsWith("/")) return path;
  const clean = path === "/" ? "" : path;
  return `/${locale}${clean}`;
}

/** Разбирает путь на локаль и остаток: "/en/catalog" → { locale: "en", path: "/catalog" }. */
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (hasLocale(first)) {
    return { locale: first, path: `/${rest.join("/")}`.replace(/\/$/, "") || "/" };
  }
  return { locale: null, path: pathname || "/" };
}

/** Выбор локали по заголовку Accept-Language. */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;
  const preferred = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number.parseFloat(q) : 1 };
    })
    .filter((item) => item.tag && !Number.isNaN(item.q))
    .sort((a, b) => b.q - a.q);
  for (const { tag } of preferred) {
    const base = tag.split("-")[0];
    if (hasLocale(base)) return base;
  }
  return defaultLocale;
}

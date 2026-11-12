import type { Metadata } from "next";
import { defaultLocale, type Locale, locales, localeTags, ogLocales } from "@/i18n/config";
import { getSiteUrl } from "@/lib/env";

/** Canonical и hreflang-альтернативы для страницы (path — без префикса языка). */
export function buildAlternates(locale: Locale, path: string): NonNullable<Metadata["alternates"]> {
  const clean = path === "/" ? "" : path;
  const languages: Record<string, string> = {};
  for (const item of locales) languages[localeTags[item]] = `/${item}${clean}`;
  languages["x-default"] = `/${defaultLocale}${clean}`;
  return { canonical: `/${locale}${clean}`, languages };
}

type PageMetaInput = {
  locale: Locale;
  path: string;
  title: string;
  description?: string;
  image?: string | null;
  type?: "website" | "article" | "video.tv_show" | "video.episode";
  noIndex?: boolean;
};

/** Единый набор метаданных страницы: title, description, canonical, Open Graph, Twitter. */
export function pageMetadata({ locale, path, title, description, image, type = "website", noIndex }: PageMetaInput): Metadata {
  const clean = path === "/" ? "" : path;
  const images = image ? [{ url: image }] : undefined;
  return {
    title,
    description,
    alternates: buildAlternates(locale, path),
    robots: noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      url: `/${locale}${clean}`,
      siteName: "ANIMEVERSE",
      locale: ogLocales[locale],
      alternateLocale: locales.filter((item) => item !== locale).map((item) => ogLocales[item]),
      type,
      images,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Безопасная сериализация JSON-LD для вставки в <script>. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

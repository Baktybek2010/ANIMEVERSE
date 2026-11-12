import type { Locale } from "@/i18n/config";

type TranslationRow = { locale: string; title?: string | null; description?: string | null };

export type TitleSource = {
  title_romaji: string;
  title_english?: string | null;
  title_native?: string | null;
  anime_translations?: TranslationRow[] | null;
};

/** Название аниме на языке интерфейса с запасными вариантами. */
export function localizedTitle(locale: Locale, anime: TitleSource): string {
  const translated = anime.anime_translations?.find((row) => row.locale === locale)?.title?.trim();
  if (translated) return translated;
  if (locale === "ja") return anime.title_native?.trim() || anime.title_romaji;
  return anime.title_english?.trim() || anime.title_romaji;
}

/** Описание на языке интерфейса; `isFallback` — показан текст на другом языке. */
export function localizedDescription(
  locale: Locale,
  anime: { description?: string | null; anime_translations?: TranslationRow[] | null },
): { text: string | null; isFallback: boolean } {
  const translated = anime.anime_translations?.find((row) => row.locale === locale)?.description?.trim();
  if (translated) return { text: translated, isFallback: false };
  const english = anime.anime_translations?.find((row) => row.locale === "en")?.description?.trim();
  const fallback = english || anime.description?.trim() || null;
  return { text: fallback, isFallback: Boolean(fallback) && locale !== "en" };
}

/** Значение из набора колонок `*_ru / *_en / *_ja` с запасными вариантами. */
export function localizedField(
  locale: Locale,
  values: { ru?: string | null; en?: string | null; ja?: string | null },
): string {
  const order: Locale[] = locale === "ru" ? ["ru", "en", "ja"] : locale === "en" ? ["en", "ru", "ja"] : ["ja", "en", "ru"];
  for (const key of order) {
    const value = values[key]?.trim();
    if (value) return value;
  }
  return "";
}

/** Переводит HTML-описания AniList в безопасный простой текст с абзацами. */
export function descriptionToParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

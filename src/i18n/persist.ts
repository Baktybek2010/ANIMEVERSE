import { type Locale, LOCALE_COOKIE } from "./config";

/** Сохраняет выбранный язык в cookie на год (читается proxy при следующем запросе). */
export function persistLocale(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

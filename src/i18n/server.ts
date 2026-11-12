import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { hasLocale, type Locale } from "./config";
import { type Dictionary, getDictionary } from "./dictionaries";

/** Текущая локаль из корневого сегмента маршрута `[lang]`. */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

/** Локаль и словарь для серверных компонентов. */
export async function getI18n(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: await getDictionary(locale) };
}

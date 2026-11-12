import { type Locale, localeTags } from "./config";

export type PluralForms = { one: string; few?: string; many?: string; other: string };

/** Подстановка параметров: fmt("Привет, {name}", { name: "Аня" }). */
export function fmt(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

/** Склонение по правилам языка: plural("ru", 5, forms) → "5 серий". */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(localeTags[locale]);
    pluralRules.set(locale, rules);
  }
  const category = rules.select(count);
  const template =
    (category === "one" && forms.one) ||
    (category === "few" && forms.few) ||
    (category === "many" && forms.many) ||
    forms.other;
  return fmt(template, { count: formatNumber(locale, count) });
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(localeTags[locale]).format(value);
}

export function formatCompact(locale: Locale, value: number): string {
  return new Intl.NumberFormat(localeTags[locale], { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatDate(
  locale: Locale,
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  // Фиксированный часовой пояс: одинаковый результат на сервере и в браузере (без ошибок гидратации).
  return new Intl.DateTimeFormat(localeTags[locale], { timeZone: "UTC", ...options }).format(date);
}

export function formatDateTime(locale: Locale, value: string | Date | null | undefined): string {
  return formatDate(locale, value, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMoney(locale: Locale, cents: number, currency: string): string {
  return new Intl.NumberFormat(localeTags[locale], {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Длительность в формате 1:23:45 или 23:45. */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

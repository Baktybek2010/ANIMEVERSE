import { describe, expect, it } from "vitest";
import { hasLocale, localizePath, matchLocale, splitLocale } from "@/i18n/config";
import adminEn from "@/i18n/dictionaries/admin/en";
import adminJa from "@/i18n/dictionaries/admin/ja";
import adminRu from "@/i18n/dictionaries/admin/ru";
import en from "@/i18n/dictionaries/en";
import ja from "@/i18n/dictionaries/ja";
import ru from "@/i18n/dictionaries/ru";
import { fmt, formatDuration, formatMoney, plural } from "@/i18n/format";

type Tree = { [key: string]: string | Tree };

/** Плоский список «путь → строка»; формы множественного числа сводятся к одному ключу. */
function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if ("one" in value && "other" in value) out.set(path, String(value.other));
    else for (const [nestedKey, nested] of flatten(value, path)) out.set(nestedKey, nested);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(",");

describe.each([
  ["интерфейс", ru, { en, ja }],
  ["админ-панель", adminRu, { en: adminEn, ja: adminJa }],
])("словари: %s", (_name, base, translations) => {
  const reference = flatten(base as unknown as Tree);

  it.each(Object.entries(translations))("%s содержит те же ключи, что и ru", (_locale, dictionary) => {
    const keys = [...flatten(dictionary as unknown as Tree).keys()].sort();
    expect(keys).toEqual([...reference.keys()].sort());
  });

  it.each(Object.entries(translations))("%s сохраняет параметры подстановки", (_locale, dictionary) => {
    const flat = flatten(dictionary as unknown as Tree);
    const mismatched = [...reference].filter(([key, text]) => placeholders(text) !== placeholders(flat.get(key) ?? "")).map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  it.each(Object.entries(translations))("%s не содержит пустых строк там, где они есть в ru", (_locale, dictionary) => {
    const flat = flatten(dictionary as unknown as Tree);
    const empty = [...reference].filter(([key, text]) => text !== "" && !flat.get(key)?.trim()).map(([key]) => key);
    expect(empty).toEqual([]);
  });
});

describe("перевод действительно выполнен", () => {
  it("английский и японский словари не совпадают с русским", () => {
    const base = flatten(ru as unknown as Tree);
    for (const dictionary of [en, ja]) {
      const flat = flatten(dictionary as unknown as Tree);
      const same = [...base].filter(([key, text]) => /[а-яё]/i.test(text) && flat.get(key) === text);
      expect(same).toEqual([]);
    }
  });
});

describe("локали и пути", () => {
  it("распознаёт поддерживаемые локали", () => {
    expect(hasLocale("ru")).toBe(true);
    expect(hasLocale("ja")).toBe(true);
    expect(hasLocale("de")).toBe(false);
    expect(hasLocale(undefined)).toBe(false);
  });

  it("добавляет и снимает префикс языка", () => {
    expect(localizePath("en", "/")).toBe("/en");
    expect(localizePath("ja", "/catalog")).toBe("/ja/catalog");
    expect(splitLocale("/en/anime/one-piece")).toEqual({ locale: "en", path: "/anime/one-piece" });
    expect(splitLocale("/ru")).toEqual({ locale: "ru", path: "/" });
    expect(splitLocale("/catalog")).toEqual({ locale: null, path: "/catalog" });
  });

  it("выбирает язык по Accept-Language", () => {
    expect(matchLocale("ja-JP,ja;q=0.9,en;q=0.8")).toBe("ja");
    expect(matchLocale("de-DE,de;q=0.9,en;q=0.5")).toBe("en");
    expect(matchLocale("fr-FR")).toBe("ru");
    expect(matchLocale(null)).toBe("ru");
  });
});

describe("форматирование", () => {
  it("подставляет параметры", () => {
    expect(fmt("Серия {number} из {total}", { number: 3, total: 12 })).toBe("Серия 3 из 12");
    expect(fmt("Привет, {name}")).toBe("Привет, {name}");
  });

  it("склоняет по правилам русского языка", () => {
    const forms = ru.anime.episodesCount;
    expect(plural("ru", 1, forms)).toBe("1 серия");
    expect(plural("ru", 3, forms)).toBe("3 серии");
    expect(plural("ru", 12, forms)).toBe("12 серий");
    expect(plural("ru", 21, forms)).toBe("21 серия");
    expect(plural("en", 1, en.anime.episodesCount)).toBe("1 episode");
    expect(plural("en", 5, en.anime.episodesCount)).toBe("5 episodes");
  });

  it("форматирует длительность и деньги", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(Number.NaN)).toBe("0:00");
    expect(formatMoney("en", 499, "usd")).toBe("$4.99");
    expect(formatMoney("en", 5000, "usd")).toBe("$50");
  });
});

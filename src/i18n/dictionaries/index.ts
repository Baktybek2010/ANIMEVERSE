import type { Locale } from "../config";
import type { Dictionary } from "./ru";

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  ru: () => import("./ru").then((module) => module.default),
  en: () => import("./en").then((module) => module.default),
  ja: () => import("./ja").then((module) => module.default),
};

export type { Dictionary };

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}

import type { Locale } from "../../config";
import type { AdminDictionary } from "./ru";

const loaders: Record<Locale, () => Promise<AdminDictionary>> = {
  ru: () => import("./ru").then((module) => module.default),
  en: () => import("./en").then((module) => module.default),
  ja: () => import("./ja").then((module) => module.default),
};

export type { AdminDictionary };

export function getAdminDictionary(locale: Locale): Promise<AdminDictionary> {
  return loaders[locale]();
}

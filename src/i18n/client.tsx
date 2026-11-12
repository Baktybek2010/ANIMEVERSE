"use client";

import { createContext, type ReactNode, use } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries";

type I18nValue = { locale: Locale; t: Dictionary };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, dictionary, children }: { locale: Locale; dictionary: Dictionary; children: ReactNode }) {
  return <I18nContext value={{ locale, t: dictionary }}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = use(I18nContext);
  if (!value) throw new Error("useI18n должен вызываться внутри I18nProvider");
  return value;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

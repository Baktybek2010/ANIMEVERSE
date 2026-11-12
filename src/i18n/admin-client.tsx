"use client";

import { createContext, type ReactNode, use } from "react";
import type { AdminDictionary } from "./dictionaries/admin";

const AdminI18nContext = createContext<AdminDictionary | null>(null);

export function AdminI18nProvider({ dictionary, children }: { dictionary: AdminDictionary; children: ReactNode }) {
  return <AdminI18nContext value={dictionary}>{children}</AdminI18nContext>;
}

/** Словарь админ-панели (подгружается только в разделе /admin). */
export function useAdminI18n(): AdminDictionary {
  const value = use(AdminI18nContext);
  if (!value) throw new Error("useAdminI18n должен вызываться внутри AdminI18nProvider");
  return value;
}

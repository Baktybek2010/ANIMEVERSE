import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { AdminNav, AdminNavFallback } from "@/components/admin/admin-nav";
import { Skeleton } from "@/components/ui/misc";
import { AdminI18nProvider } from "@/i18n/admin-client";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { getLocale } from "@/i18n/server";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · ANIMEVERSE" }, robots: { index: false, follow: false } };

/** Доступ в админ-панель проверяется на сервере по роли из базы данных. */
async function Sidebar() {
  const locale = await getLocale();
  const user = await requirePermission(locale, "admin.access", `/${locale}/admin`);
  return <AdminNav isAdmin={can(user.role, "users.manage")} />;
}

async function Gate({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  await requirePermission(locale, "admin.access", `/${locale}/admin`);
  return <>{children}</>;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dictionary = await getAdminDictionary(locale);
  return (
    <AdminI18nProvider dictionary={dictionary}>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <Suspense fallback={<AdminNavFallback />}>
          <Sidebar />
        </Suspense>
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Suspense
            fallback={
              <div aria-hidden>
                <Skeleton className="h-9 w-64" />
                <Skeleton className="mt-6 h-96 w-full rounded-2xl" />
              </div>
            }
          >
            <Gate>{children}</Gate>
          </Suspense>
        </main>
      </div>
    </AdminI18nProvider>
  );
}

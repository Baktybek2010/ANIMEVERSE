import { Wrench } from "lucide-react";
import { type ReactNode, Suspense } from "react";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MobileNav, MobileNavFallback } from "@/components/layout/mobile-nav";
import { EmptyState } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicSettings } from "@/lib/data/catalog";

/** В режиме техработ сайт видит только персонал. */
async function MaintenanceGate({ children }: { children: ReactNode }) {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (user && !user.isBanned && can(user.role, "admin.access")) return <>{children}</>;
  return (
    <div className="container-page py-24">
      <EmptyState icon={Wrench} title={t.pages.maintenanceTitle} text={t.pages.maintenanceText} />
    </div>
  );
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [{ t }, settings] = await Promise.all([getI18n(), getPublicSettings()]);

  return (
    <>
      <a
        href="#main"
        className="bg-brand-gradient sr-only z-[70] rounded-lg px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.nav.skipToContent}
      </a>
      <Header />
      <main id="main" className="flex-1">
        {settings.maintenanceMode ? (
          <Suspense fallback={null}>
            <MaintenanceGate>{children}</MaintenanceGate>
          </Suspense>
        ) : (
          children
        )}
      </main>
      <Footer />
      <Suspense fallback={<MobileNavFallback />}>
        <MobileNav />
      </Suspense>
    </>
  );
}

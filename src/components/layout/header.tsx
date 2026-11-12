import { Suspense } from "react";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { MainNav, MainNavFallback } from "./main-nav";
import { SearchBox } from "./search-box";
import { UserArea } from "./user-area";

export async function Header() {
  const { t } = await getI18n();
  return (
    <header className="glass sticky top-0 z-50 border-b border-line">
      <div className="container-page flex h-16 items-center gap-3 sm:gap-6">
        <Link href="/" aria-label={`${t.common.appName} — ${t.nav.home}`} className="shrink-0 rounded-lg">
          <span className="hidden sm:inline">
            <Logo />
          </span>
          <span className="sm:hidden">
            <Logo compact />
          </span>
        </Link>
        <Suspense fallback={<MainNavFallback />}>
          <MainNav />
        </Suspense>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <SearchBox />
          <LocaleSwitcher />
          <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
            <UserArea />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

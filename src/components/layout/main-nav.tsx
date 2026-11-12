"use client";

import { usePathname } from "next/navigation";
import { splitLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/catalog", key: "catalog" },
  { href: "/news", key: "news" },
  { href: "/premium", key: "premium" },
] as const;

export function isActivePath(current: string, href: string): boolean {
  return href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`);
}

function NavLinks({ current }: { current: string | null }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t.nav.menu} className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.map((item) => {
        const active = current !== null && isActivePath(current, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "text-fg" : "text-muted hover:text-fg",
              item.key === "premium" && !active && "text-gold/90 hover:text-gold",
            )}
          >
            {t.nav[item.key]}
            {active ? <span aria-hidden className="bg-brand-gradient absolute inset-x-3.5 -bottom-[0.95rem] h-0.5 rounded-full" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function MainNav() {
  const pathname = usePathname();
  return <NavLinks current={splitLocale(pathname).path} />;
}

/** Запасной вариант до гидратации маршрута: те же ссылки без подсветки. */
export function MainNavFallback() {
  return <NavLinks current={null} />;
}

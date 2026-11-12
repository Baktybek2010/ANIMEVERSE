"use client";

import { Compass, Crown, House, Newspaper, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { splitLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";
import { isActivePath } from "./main-nav";

function Bar({ current }: { current: string | null }) {
  const { t } = useI18n();
  const items = [
    { href: "/", label: t.nav.home, icon: House },
    { href: "/catalog", label: t.nav.catalog, icon: Compass },
    { href: "/premium", label: t.nav.premium, icon: Crown },
    { href: "/news", label: t.nav.news, icon: Newspaper },
    { href: "/account", label: t.nav.profile, icon: UserRound },
  ];
  // На странице просмотра и в админке нижняя панель скрыта, чтобы не перекрывать интерфейс.
  if (current && (current.startsWith("/admin") || current.startsWith("/watch/"))) return null;

  return (
    <nav
      aria-label={t.nav.menu}
      className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = current !== null && isActivePath(current, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-15 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium transition-colors",
                  active ? "text-brand-soft" : "text-dim hover:text-fg",
                )}
              >
                <item.icon className={cn("size-5", active && "drop-shadow-[0_0_8px_rgb(167_139_250/0.8)]")} aria-hidden />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return <Bar current={splitLocale(pathname).path} />;
}

export function MobileNavFallback() {
  return <Bar current={null} />;
}

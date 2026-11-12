"use client";

import { Bell, Bookmark, Crown, Heart, History, Settings, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { splitLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";

function Nav({ current }: { current: string | null }) {
  const { t } = useI18n();
  const items = [
    { href: "/account", label: t.nav.profile, icon: UserRound },
    { href: "/account/favorites", label: t.nav.favorites, icon: Heart },
    { href: "/account/watchlist", label: t.nav.watchlist, icon: Bookmark },
    { href: "/account/history", label: t.nav.history, icon: History },
    { href: "/account/notifications", label: t.nav.notifications, icon: Bell },
    { href: "/account/subscription", label: t.nav.subscription, icon: Crown },
    { href: "/account/settings", label: t.nav.settings, icon: Settings },
  ];
  return (
    <nav aria-label={t.account.title}>
      <ul className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
        {items.map((item) => {
          const active = current === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "bg-brand/20 text-fg ring-1 ring-brand/40" : "text-muted hover:bg-white/6 hover:text-fg",
                )}
              >
                <item.icon className={cn("size-4.5", active && "text-brand-soft")} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AccountNav() {
  const pathname = usePathname();
  return <Nav current={splitLocale(pathname).path} />;
}

export function AccountNavFallback() {
  return <Nav current={null} />;
}

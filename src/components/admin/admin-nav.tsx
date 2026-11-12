"use client";

import {
  ArrowLeft, Clapperboard, CloudDownload, CreditCard, GalleryHorizontal, LayoutDashboard, Newspaper, ScrollText, Settings, Tags, Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { splitLocale } from "@/i18n/config";
import { useAdminI18n } from "@/i18n/admin-client";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Logo } from "@/components/layout/logo";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboard, admin: false },
  { href: "/admin/anime", key: "anime", icon: Clapperboard, admin: false },
  { href: "/admin/import", key: "import", icon: CloudDownload, admin: false },
  { href: "/admin/genres", key: "genres", icon: Tags, admin: false },
  { href: "/admin/banners", key: "banners", icon: GalleryHorizontal, admin: false },
  { href: "/admin/news", key: "news", icon: Newspaper, admin: false },
  { href: "/admin/users", key: "users", icon: Users, admin: false },
  { href: "/admin/subscriptions", key: "subscriptions", icon: CreditCard, admin: true },
  { href: "/admin/settings", key: "settings", icon: Settings, admin: true },
  { href: "/admin/logs", key: "logs", icon: ScrollText, admin: true },
] as const;

function Nav({ current, isAdmin }: { current: string | null; isAdmin: boolean }) {
  const a = useAdminI18n();
  return (
    <aside className="border-b border-line bg-surface/80 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 py-4 lg:px-5">
        <Link href="/admin" className="rounded-lg" aria-label={a.nav.title}>
          <Logo />
        </Link>
        <LocaleSwitcher />
      </div>
      <nav aria-label={a.nav.title} className="px-3 pb-3 lg:pb-6">
        <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">
          {ITEMS.filter((item) => isAdmin || !item.admin).map((item) => {
            const active = current !== null && (item.href === "/admin" ? current === "/admin" : current === item.href || current.startsWith(`${item.href}/`));
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                    active ? "bg-brand/20 text-fg ring-1 ring-brand/40" : "text-muted hover:bg-white/6 hover:text-fg",
                  )}
                >
                  <item.icon className={cn("size-4.5", active && "text-brand-soft")} aria-hidden />
                  {a.nav[item.key]}
                </Link>
              </li>
            );
          })}
          <li className="shrink-0 lg:mt-4 lg:border-t lg:border-line lg:pt-4">
            <Link href="/" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:bg-white/6 hover:text-fg">
              <ArrowLeft className="size-4.5" aria-hidden />
              {a.nav.backToSite}
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  );
}

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return <Nav current={splitLocale(pathname).path} isAdmin={isAdmin} />;
}

export function AdminNavFallback() {
  return <Nav current={null} isAdmin={false} />;
}

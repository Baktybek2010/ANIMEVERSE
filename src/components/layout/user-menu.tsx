"use client";

import { Bell, Bookmark, Crown, Heart, History, LayoutDashboard, LogOut, Settings, Sparkles, UserRound } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Dropdown, menuItemClass } from "@/components/ui/dropdown";
import { Link } from "@/components/ui/link";
import { Avatar } from "@/components/ui/misc";
import { logoutAction } from "@/lib/actions/auth";

export type UserMenuData = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isPremium: boolean;
  canAccessAdmin: boolean;
  unreadNotifications: number;
};

export function UserMenu({ user }: { user: UserMenuData }) {
  const { t, locale } = useI18n();

  const items = [
    { href: "/account", label: t.nav.profile, icon: UserRound },
    { href: "/account/favorites", label: t.nav.favorites, icon: Heart },
    { href: "/account/watchlist", label: t.nav.watchlist, icon: Bookmark },
    { href: "/account/history", label: t.nav.history, icon: History },
    { href: "/account/subscription", label: t.nav.subscription, icon: Crown },
    { href: "/account/settings", label: t.nav.settings, icon: Settings },
  ];

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/account/notifications"
        aria-label={user.unreadNotifications > 0 ? `${t.nav.notifications} (${user.unreadNotifications})` : t.nav.notifications}
        className="relative hidden size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-white/8 hover:text-fg sm:grid"
      >
        <Bell className="size-5" aria-hidden />
        {user.unreadNotifications > 0 ? (
          <span className="bg-brand-gradient absolute top-1.5 right-1.5 grid min-w-4.5 place-items-center rounded-full px-1 text-[0.65rem] leading-4.5 font-semibold text-white">
            {user.unreadNotifications > 9 ? "9+" : user.unreadNotifications}
          </span>
        ) : null}
      </Link>

      <Dropdown
        label={t.nav.userMenu}
        triggerClassName="flex items-center gap-2 rounded-full p-0.5 pr-0.5 transition-shadow hover:shadow-glow sm:pr-2.5"
        trigger={
          <>
            <span className="relative">
              <Avatar src={user.avatarUrl} name={user.displayName} size={36} />
              {user.isPremium ? (
                <span className="absolute -right-1 -bottom-1 grid size-4.5 place-items-center rounded-full bg-gold text-night ring-2 ring-night">
                  <Crown className="size-2.5" aria-hidden />
                </span>
              ) : null}
            </span>
            <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{user.displayName}</span>
          </>
        }
        className="w-64"
      >
        {(close) => (
          <>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Avatar src={user.avatarUrl} name={user.displayName} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.displayName}</p>
                <p className="truncate text-xs text-dim">@{user.username}</p>
              </div>
            </div>
            {!user.isPremium ? (
              <Link
                href="/premium"
                role="menuitem"
                onClick={close}
                className="mx-1.5 mb-1.5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400/15 to-orange-400/10 px-3 py-2.5 text-sm font-medium text-gold transition-colors hover:from-amber-400/25"
              >
                <Sparkles className="size-4" aria-hidden />
                {t.account.subscription.upgrade}
              </Link>
            ) : null}
            <div className="border-t border-line pt-1.5">
              {items.map((item) => (
                <Link key={item.href} href={item.href} role="menuitem" onClick={close} className={menuItemClass}>
                  <item.icon className="size-4.5 text-muted" aria-hidden />
                  {item.label}
                </Link>
              ))}
              <Link href="/account/notifications" role="menuitem" onClick={close} className={`${menuItemClass} sm:hidden`}>
                <Bell className="size-4.5 text-muted" aria-hidden />
                <span className="flex-1">{t.nav.notifications}</span>
                {user.unreadNotifications > 0 ? (
                  <span className="rounded-full bg-brand/25 px-2 text-xs text-brand-soft">{user.unreadNotifications}</span>
                ) : null}
              </Link>
            </div>
            {user.canAccessAdmin ? (
              <div className="mt-1.5 border-t border-line pt-1.5">
                <Link href="/admin" role="menuitem" onClick={close} className={menuItemClass}>
                  <LayoutDashboard className="size-4.5 text-brand-soft" aria-hidden />
                  {t.nav.admin}
                </Link>
              </div>
            ) : null}
            <form action={logoutAction.bind(null, locale)} className="mt-1.5 border-t border-line pt-1.5">
              <button type="submit" role="menuitem" className={`${menuItemClass} text-danger hover:text-danger`}>
                <LogOut className="size-4.5" aria-hidden />
                {t.nav.logout}
              </button>
            </form>
          </>
        )}
      </Dropdown>
    </div>
  );
}

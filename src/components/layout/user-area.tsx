import { LogIn } from "lucide-react";
import { ButtonLink } from "@/components/ui/link";
import { getI18n } from "@/i18n/server";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/data/library";
import { UserMenu } from "./user-menu";

/** Правая часть шапки: меню пользователя либо кнопки входа. Читает сессию — рендерится внутри <Suspense>. */
export async function UserArea() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
          {t.nav.login}
        </ButtonLink>
        <ButtonLink href="/register" size="sm" className="hidden sm:inline-flex">
          {t.nav.register}
        </ButtonLink>
        <ButtonLink href="/login" variant="secondary" size="icon" className="sm:hidden" aria-label={t.nav.login}>
          <LogIn className="size-4.5" aria-hidden />
        </ButtonLink>
      </div>
    );
  }

  const unread = user.isBanned ? 0 : await getUnreadNotificationCount();
  return (
    <UserMenu
      user={{
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        isPremium: user.isPremium,
        canAccessAdmin: can(user.role, "admin.access") && !user.isBanned,
        unreadNotifications: unread,
      }}
    />
  );
}

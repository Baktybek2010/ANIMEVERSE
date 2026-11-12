import { Crown } from "lucide-react";
import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { AccountNav, AccountNavFallback } from "@/components/account/account-nav";
import { Avatar, Badge, Skeleton } from "@/components/ui/misc";
import { fmt, formatDate } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function AccountHeader() {
  const { locale, t } = await getI18n();
  const user = await requireUser(locale, `/${locale}/account`);
  return (
    <div className="flex items-center gap-4">
      <Avatar src={user.avatarUrl} name={user.displayName} size={64} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold sm:text-2xl">
          <span className="truncate">{user.displayName}</span>
          {user.isPremium ? (
            <Badge tone="gold">
              <Crown className="size-3" aria-hidden />
              {t.common.premium}
            </Badge>
          ) : null}
          {user.role !== "user" ? <Badge tone="brand">{t.roles[user.role]}</Badge> : null}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted">
          @{user.username} · {fmt(t.account.memberSince, { date: formatDate(locale, user.createdAt, { month: "long", year: "numeric" }) })}
        </p>
      </div>
    </div>
  );
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-page py-8 sm:py-10">
      <Suspense
        fallback={
          <div className="flex items-center gap-4" aria-hidden>
            <Skeleton className="size-16 rounded-full" />
            <div>
              <Skeleton className="h-7 w-48" />
              <Skeleton className="mt-2 h-4 w-64" />
            </div>
          </div>
        }
      >
        <AccountHeader />
      </Suspense>
      <div className="mt-8 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <Suspense fallback={<AccountNavFallback />}>
          <AccountNav />
        </Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

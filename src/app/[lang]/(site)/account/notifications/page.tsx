import { BellOff } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationsList } from "@/components/account/notifications-list";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { getNotifications } from "@/lib/data/library";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.notifications.title };
}

async function Content() {
  const { locale, t } = await getI18n();
  await requireUser(locale, `/${locale}/account/notifications`);
  const items = await getNotifications();
  if (items.length === 0) {
    return (
      <>
        <h1 className="mb-5 font-display text-2xl font-semibold">{t.account.notifications.title}</h1>
        <EmptyState icon={BellOff} title={t.account.notifications.emptyTitle} text={t.account.notifications.emptyText} />
      </>
    );
  }
  return <NotificationsList items={items} />;
}

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2.5" aria-hidden>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      }
    >
      <Content />
    </Suspense>
  );
}

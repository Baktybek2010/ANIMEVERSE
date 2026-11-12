import { History } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryList } from "@/components/account/history-list";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { getHistory } from "@/lib/data/library";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.history.title };
}

async function Content({ searchParams }: Pick<PageProps<"/[lang]/account/history">, "searchParams">) {
  const [{ locale, t }, params] = await Promise.all([getI18n(), searchParams]);
  await requireUser(locale, `/${locale}/account/history`);
  const pageValue = Number.parseInt(typeof params.page === "string" ? params.page : "1", 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 && pageValue < 1000 ? pageValue : 1;
  const history = await getHistory(locale, page);

  if (history.items.length === 0) {
    return (
      <>
        <h1 className="mb-5 font-display text-2xl font-semibold">{t.account.history.title}</h1>
        <EmptyState
          icon={History}
          title={t.account.history.emptyTitle}
          text={t.account.history.emptyText}
          action={<ButtonLink href="/catalog">{t.pages.goCatalog}</ButtonLink>}
        />
      </>
    );
  }
  return (
    <>
      <HistoryList items={history.items} />
      <div className="mt-8">
        <Pagination
          page={page}
          totalPages={history.totalPages}
          basePath="/account/history"
          labels={{ previous: t.common.previous, next: t.common.next, pageOf: fmt(t.common.pageOf, { page, total: history.totalPages }) }}
        />
      </div>
    </>
  );
}

export default function HistoryPage({ searchParams }: PageProps<"/[lang]/account/history">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-2.5" aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      }
    >
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

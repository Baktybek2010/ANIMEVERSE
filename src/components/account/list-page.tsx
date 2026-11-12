import type { LucideIcon } from "lucide-react";
import { AnimeGrid } from "@/components/anime/anime-card";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { getUserList } from "@/lib/data/library";

type Props = {
  table: "favorites" | "watchlist";
  path: string;
  icon: LucideIcon;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Общая страница списков «Избранное» и «Смотреть позже». */
export async function UserListContent({ table, path, icon, searchParams }: Props) {
  const [{ locale, t }, params] = await Promise.all([getI18n(), searchParams]);
  await requireUser(locale, `/${locale}${path}`);
  const pageValue = Number.parseInt(typeof params.page === "string" ? params.page : "1", 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 && pageValue < 1000 ? pageValue : 1;
  const list = await getUserList(table, locale, page);
  const copy = t.account[table];

  return (
    <section aria-labelledby="list-title">
      <h1 id="list-title" className="mb-5 font-display text-2xl font-semibold">
        {copy.title}
      </h1>
      {list.items.length === 0 ? (
        <EmptyState
          icon={icon}
          title={copy.emptyTitle}
          text={copy.emptyText}
          action={<ButtonLink href="/catalog">{t.pages.goCatalog}</ButtonLink>}
        />
      ) : (
        <>
          <AnimeGrid items={list.items} />
          <div className="mt-8">
            <Pagination
              page={page}
              totalPages={list.totalPages}
              basePath={path}
              labels={{ previous: t.common.previous, next: t.common.next, pageOf: fmt(t.common.pageOf, { page, total: list.totalPages }) }}
            />
          </div>
        </>
      )}
    </section>
  );
}

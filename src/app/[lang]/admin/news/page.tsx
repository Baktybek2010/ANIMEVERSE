import { Plus } from "lucide-react";
import { AdminHeader, EmptyRow, TableWrap } from "@/components/admin/ui";
import { ButtonLink, Link } from "@/components/ui/link";
import { Badge } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { fmt, formatDateTime } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getAdminNews, parsePage } from "@/lib/data/admin";

export default async function AdminNewsPage({ searchParams }: PageProps<"/[lang]/admin/news">) {
  const [{ locale, t }, params] = await Promise.all([getI18n(), searchParams]);
  const a = await getAdminDictionary(locale);
  await requirePermission(locale, "content.manage");
  const page = parsePage(params.page);
  const list = await getAdminNews(page);
  return (
    <>
      <AdminHeader
        title={a.news.title}
        description={fmt(a.common.total, { count: list.total })}
        actions={
          <ButtonLink href="/admin/news/new">
            <Plus className="size-4" aria-hidden />
            {a.news.add}
          </ButtonLink>
        }
      />
      <TableWrap>
        <thead>
          <tr>
            <th scope="col">{a.news.titleRu}</th>
            <th scope="col">{a.anime.status}</th>
            <th scope="col">{a.news.publishedAt}</th>
            <th scope="col">{a.common.updated}</th>
          </tr>
        </thead>
        <tbody>
          {list.items.length === 0 ? <EmptyRow colSpan={4} text={a.common.noData} /> : null}
          {list.items.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-white/[0.03]">
              <td>
                <Link href={`/admin/news/${item.id}`} className="font-medium hover:text-brand-soft">
                  {item.title_ru}
                </Link>
                <span className="block text-xs text-dim">/{item.slug}</span>
              </td>
              <td>
                <Badge tone={item.is_published ? "success" : "neutral"}>{item.is_published ? a.common.published : a.common.draft}</Badge>
              </td>
              <td className="whitespace-nowrap text-xs text-dim">{item.published_at ? formatDateTime(locale, item.published_at) : "—"}</td>
              <td className="whitespace-nowrap text-xs text-dim">{formatDateTime(locale, item.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <div className="mt-6">
        <Pagination page={page} totalPages={list.totalPages} basePath="/admin/news" labels={{ previous: t.common.previous, next: t.common.next, pageOf: fmt(t.common.pageOf, { page, total: list.totalPages }) }} />
      </div>
    </>
  );
}

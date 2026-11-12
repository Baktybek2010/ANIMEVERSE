import { AdminHeader, EmptyRow, TableWrap } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/pagination";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { fmt, formatDateTime } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getAdminLogs, parsePage } from "@/lib/data/admin";

export default async function AdminLogsPage({ searchParams }: PageProps<"/[lang]/admin/logs">) {
  const [{ locale, t }, params] = await Promise.all([getI18n(), searchParams]);
  const a = await getAdminDictionary(locale);
  await requirePermission(locale, "logs.view");
  const page = parsePage(params.page);
  const list = await getAdminLogs(page);
  return (
    <>
      <AdminHeader title={a.logs.title} description={fmt(a.common.total, { count: list.total })} />
      <TableWrap>
        <thead>
          <tr>
            <th scope="col">{a.logs.date}</th>
            <th scope="col">{a.logs.actor}</th>
            <th scope="col">{a.logs.action}</th>
            <th scope="col">{a.logs.entity}</th>
            <th scope="col">{a.logs.details}</th>
          </tr>
        </thead>
        <tbody>
          {list.items.length === 0 ? <EmptyRow colSpan={5} text={a.logs.empty} /> : null}
          {list.items.map((log) => (
            <tr key={log.id}>
              <td className="whitespace-nowrap text-xs text-dim">{formatDateTime(locale, log.created_at)}</td>
              <td>@{log.actor?.username ?? a.logs.system}</td>
              <td>
                <code className="rounded bg-white/8 px-1.5 py-0.5 text-xs text-brand-soft">{log.action}</code>
              </td>
              <td className="text-xs text-muted">
                {log.entity_type}
                {log.entity_id ? <span className="block max-w-40 truncate text-dim">{log.entity_id}</span> : null}
              </td>
              <td className="max-w-xs truncate text-xs text-dim" title={JSON.stringify(log.details)}>
                {JSON.stringify(log.details)}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <div className="mt-6">
        <Pagination page={page} totalPages={list.totalPages} basePath="/admin/logs" labels={{ previous: t.common.previous, next: t.common.next, pageOf: fmt(t.common.pageOf, { page, total: list.totalPages }) }} />
      </div>
    </>
  );
}

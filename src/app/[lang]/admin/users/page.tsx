import { AdminHeader, EmptyRow, SearchForm, TableWrap } from "@/components/admin/ui";
import { Link } from "@/components/ui/link";
import { Avatar, Badge } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { localizePath } from "@/i18n/config";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { fmt, formatDate } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getAdminUsers, parsePage } from "@/lib/data/admin";

export default async function AdminUsersPage({ searchParams }: PageProps<"/[lang]/admin/users">) {
  const [{ locale, t }, params] = await Promise.all([getI18n(), searchParams]);
  const a = await getAdminDictionary(locale);
  await requirePermission(locale, "users.view");
  const q = typeof params.q === "string" ? params.q : "";
  const page = parsePage(params.page);
  const list = await getAdminUsers({ q, page });

  return (
    <>
      <AdminHeader title={a.users.title} description={fmt(a.common.total, { count: list.total })} />
      <SearchForm action={localizePath(locale, "/admin/users")} defaultValue={q} placeholder={a.users.searchPlaceholder} label={a.common.search} />
      <TableWrap>
        <thead>
          <tr>
            <th scope="col">{a.users.user}</th>
            <th scope="col">{a.users.role}</th>
            <th scope="col">{a.users.status}</th>
            <th scope="col">{a.users.subscription}</th>
            <th scope="col">{a.users.registered}</th>
          </tr>
        </thead>
        <tbody>
          {list.items.length === 0 ? <EmptyRow colSpan={5} text={a.common.noData} /> : null}
          {list.items.map((user) => (
            <tr key={user.id} className="transition-colors hover:bg-white/[0.03]">
              <td>
                <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3 hover:text-brand-soft">
                  <Avatar src={user.avatar_url} name={user.display_name || user.username} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{user.display_name || user.username}</span>
                    <span className="block truncate text-xs text-dim">
                      @{user.username} · {user.email}
                    </span>
                  </span>
                </Link>
              </td>
              <td>
                <Badge tone={user.role === "user" ? "neutral" : "brand"}>{t.roles[user.role]}</Badge>
              </td>
              <td>
                <Badge tone={user.is_banned ? "danger" : "success"}>{user.is_banned ? a.users.banned : a.users.active}</Badge>
              </td>
              <td>
                <Badge tone={user.isPremium ? "gold" : "neutral"}>{user.isPremium ? a.users.premium : a.users.free}</Badge>
              </td>
              <td className="whitespace-nowrap text-xs text-dim">{formatDate(locale, user.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <div className="mt-6">
        <Pagination
          page={page}
          totalPages={list.totalPages}
          basePath="/admin/users"
          query={{ q: q || undefined }}
          labels={{ previous: t.common.previous, next: t.common.next, pageOf: fmt(t.common.pageOf, { page, total: list.totalPages }) }}
        />
      </div>
    </>
  );
}

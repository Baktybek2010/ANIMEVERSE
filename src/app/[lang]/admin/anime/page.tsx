import { Plus } from "lucide-react";
import Image from "next/image";
import { AdminHeader, EmptyRow, SearchForm, TableWrap } from "@/components/admin/ui";
import { Select } from "@/components/ui/field";
import { ButtonLink, Link } from "@/components/ui/link";
import { Badge } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { localizePath } from "@/i18n/config";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { fmt, formatCompact, formatDateTime } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getAdminAnimeList, parsePage } from "@/lib/data/admin";

export default async function AdminAnimePage({ searchParams }: PageProps<"/[lang]/admin/anime">) {
  const [{ locale, t }, params] = await Promise.all([getI18n(), searchParams]);
  const a = await getAdminDictionary(locale);
  await requirePermission(locale, "content.manage");
  const q = typeof params.q === "string" ? params.q : "";
  const filter = typeof params.filter === "string" ? params.filter : "";
  const page = parsePage(params.page);
  const list = await getAdminAnimeList({ q, filter, page });

  return (
    <>
      <AdminHeader
        title={a.anime.title}
        description={fmt(a.common.total, { count: list.total })}
        actions={
          <ButtonLink href="/admin/anime/new">
            <Plus className="size-4" aria-hidden />
            {a.anime.new}
          </ButtonLink>
        }
      />
      <SearchForm action={localizePath(locale, "/admin/anime")} defaultValue={q} placeholder={a.anime.searchPlaceholder} label={a.common.search}>
        <Select name="filter" defaultValue={filter} aria-label={a.anime.status} className="w-auto min-w-44">
          <option value="">{a.anime.filterAll}</option>
          <option value="published">{a.anime.filterPublished}</option>
          <option value="drafts">{a.anime.filterDrafts}</option>
        </Select>
      </SearchForm>
      <TableWrap>
        <thead>
          <tr>
            <th scope="col">{a.anime.title}</th>
            <th scope="col">{a.anime.format}</th>
            <th scope="col">{a.anime.status}</th>
            <th scope="col">{a.anime.views}</th>
            <th scope="col">{a.common.updated}</th>
          </tr>
        </thead>
        <tbody>
          {list.items.length === 0 ? <EmptyRow colSpan={5} text={a.common.noData} /> : null}
          {list.items.map((anime) => (
            <tr key={anime.id} className="transition-colors hover:bg-white/[0.03]">
              <td>
                <Link href={`/admin/anime/${anime.id}`} className="flex items-center gap-3 hover:text-brand-soft">
                  <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-elevated">
                    {anime.poster_url ? <Image src={anime.poster_url} alt="" fill sizes="40px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 font-medium">{anime.title_romaji}</span>
                    <span className="block text-xs text-dim">
                      /{anime.slug}
                      {anime.season_year ? ` · ${anime.season_year}` : ""}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="whitespace-nowrap text-muted">{t.formats[anime.format]}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={anime.is_published ? "success" : "neutral"}>{anime.is_published ? a.common.published : a.common.draft}</Badge>
                  {anime.anilist_id ? <Badge tone="sky">{a.anime.anilist}</Badge> : null}
                </div>
              </td>
              <td className="tabular-nums text-muted">{formatCompact(locale, anime.views_count)}</td>
              <td className="whitespace-nowrap text-xs text-dim">{formatDateTime(locale, anime.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <div className="mt-6">
        <Pagination
          page={page}
          totalPages={list.totalPages}
          basePath="/admin/anime"
          query={{ q: q || undefined, filter: filter || undefined }}
          labels={{ previous: t.common.previous, next: t.common.next, pageOf: fmt(t.common.pageOf, { page, total: list.totalPages }) }}
        />
      </div>
    </>
  );
}

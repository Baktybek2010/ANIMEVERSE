import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { NewsForm } from "@/components/admin/content-managers";
import { AdminHeader } from "@/components/admin/ui";
import { Link } from "@/components/ui/link";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { getLocale } from "@/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getAdminNewsItem } from "@/lib/data/admin";
import { uuidSchema } from "@/lib/validation/admin";

export default async function AdminNewsEditPage({ params }: PageProps<"/[lang]/admin/news/[id]">) {
  const [locale, { id }] = await Promise.all([getLocale(), params]);
  const a = await getAdminDictionary(locale);
  await requirePermission(locale, "content.manage");
  if (!uuidSchema.safeParse(id).success) notFound();
  const item = await getAdminNewsItem(id);
  if (!item) notFound();
  return (
    <>
      <Link href="/admin/news" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-soft hover:underline">
        <ChevronLeft className="size-4" aria-hidden />
        {a.news.title}
      </Link>
      <AdminHeader title={a.news.edit} description={`/${item.slug}`} />
      <NewsForm
        key={item.updated_at}
        id={item.id}
        initial={{
          slug: item.slug, title_ru: item.title_ru, title_en: item.title_en ?? "", title_ja: item.title_ja ?? "",
          body_ru: item.body_ru, body_en: item.body_en ?? "", body_ja: item.body_ja ?? "",
          cover_url: item.cover_url ?? "", is_published: item.is_published,
        }}
      />
    </>
  );
}

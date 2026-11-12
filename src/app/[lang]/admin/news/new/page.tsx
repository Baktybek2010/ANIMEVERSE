import { NewsForm } from "@/components/admin/content-managers";
import { AdminHeader } from "@/components/admin/ui";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { getLocale } from "@/i18n/server";
import { requirePermission } from "@/lib/auth/session";

export default async function AdminNewsNewPage() {
  const locale = await getLocale();
  const a = await getAdminDictionary(locale);
  await requirePermission(locale, "content.manage");
  return (
    <>
      <AdminHeader title={a.news.add} />
      <NewsForm id={null} initial={{ slug: "", title_ru: "", title_en: "", title_ja: "", body_ru: "", body_en: "", body_ja: "", cover_url: "", is_published: false }} />
    </>
  );
}

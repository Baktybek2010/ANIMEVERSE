import { BannersManager } from "@/components/admin/content-managers";
import { AdminHeader } from "@/components/admin/ui";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { getLocale } from "@/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getAdminBanners } from "@/lib/data/admin";

export default async function AdminBannersPage() {
  const locale = await getLocale();
  const a = await getAdminDictionary(locale);
  await requirePermission(locale, "content.manage");
  const banners = await getAdminBanners();
  return (
    <>
      <AdminHeader title={a.banners.title} description={a.banners.description} />
      <BannersManager banners={banners} />
    </>
  );
}

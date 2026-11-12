import { GenresManager } from "@/components/admin/content-managers";
import { AdminHeader } from "@/components/admin/ui";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { getLocale } from "@/i18n/server";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { getAdminGenres } from "@/lib/data/admin";

export default async function AdminGenresPage() {
  const locale = await getLocale();
  const a = await getAdminDictionary(locale);
  const user = await requirePermission(locale, "content.manage");
  const genres = await getAdminGenres();
  return (
    <>
      <AdminHeader title={a.genres.title} />
      <GenresManager genres={genres} canDelete={can(user.role, "content.delete")} />
    </>
  );
}

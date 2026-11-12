import { ImportPanel } from "@/components/admin/import-panel";
import { AdminHeader } from "@/components/admin/ui";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { getLocale } from "@/i18n/server";
import { requirePermission } from "@/lib/auth/session";

export default async function AdminImportPage() {
  const locale = await getLocale();
  const a = await getAdminDictionary(locale);
  await requirePermission(locale, "import.run");
  return (
    <>
      <AdminHeader title={a.import.title} description={a.import.description} />
      <ImportPanel />
    </>
  );
}

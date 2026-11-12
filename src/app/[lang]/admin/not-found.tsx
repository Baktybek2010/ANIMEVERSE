import { ButtonLink } from "@/components/ui/link";
import { EmptyState } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";

export default async function AdminNotFound() {
  const { t } = await getI18n();
  return <EmptyState title={t.pages.notFoundTitle} text={t.errors.notFound} action={<ButtonLink href="/admin">{t.nav.admin}</ButtonLink>} />;
}

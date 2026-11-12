import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OfflinePage() {
  const { t } = await getI18n();
  return (
    <div className="container-page py-24">
      <EmptyState icon={WifiOff} title={t.pages.offlineTitle} text={t.pages.offlineText} />
    </div>
  );
}

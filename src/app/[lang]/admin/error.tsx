"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return <ErrorState title={t.pages.errorTitle} text={t.pages.errorText} action={<Button onClick={reset}>{t.common.retry}</Button>} />;
}

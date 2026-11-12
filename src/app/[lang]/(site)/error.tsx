"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/link";
import { ErrorState } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page py-20">
      <ErrorState
        title={t.pages.errorTitle}
        text={t.pages.errorText}
        action={
          <>
            <Button onClick={reset}>{t.common.retry}</Button>
            <ButtonLink href="/" variant="secondary">
              {t.pages.goHome}
            </ButtonLink>
          </>
        }
      />
      {error.digest ? <p className="mt-4 text-center text-xs text-dim">ID: {error.digest}</p> : null}
    </div>
  );
}

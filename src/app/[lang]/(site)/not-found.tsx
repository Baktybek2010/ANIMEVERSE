import { Telescope } from "lucide-react";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="container-page py-20">
      <p className="text-gradient mb-6 text-center font-display text-7xl font-bold sm:text-8xl" aria-hidden>
        404
      </p>
      <EmptyState
        icon={Telescope}
        title={t.pages.notFoundTitle}
        text={t.pages.notFoundText}
        action={
          <>
            <ButtonLink href="/">{t.pages.goHome}</ButtonLink>
            <ButtonLink href="/catalog" variant="secondary">
              {t.pages.goCatalog}
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}

import { CircleCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { RefreshButton } from "@/components/premium/billing-buttons";
import { ButtonLink } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.premium.successTitle, robots: { index: false, follow: false } };
}

/** Статус читается из базы: страница не включает Premium сама, а показывает результат webhook. */
async function Status() {
  const { locale, t } = await getI18n();
  const user = await requireUser(locale, `/${locale}/premium/success`);
  return user.isPremium ? (
    <>
      <CircleCheck className="mx-auto size-14 text-success" aria-hidden />
      <h1 className="mt-4 font-display text-2xl font-semibold">{t.premium.successTitle}</h1>
      <p className="mt-2 text-muted">{t.premium.successActive}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/catalog">{t.pages.goCatalog}</ButtonLink>
        <ButtonLink href="/account/subscription" variant="secondary">
          {t.nav.subscription}
        </ButtonLink>
      </div>
    </>
  ) : (
    <>
      <Clock className="mx-auto size-14 text-gold" aria-hidden />
      <h1 className="mt-4 font-display text-2xl font-semibold">{t.premium.successTitle}</h1>
      <p className="mt-2 text-muted" role="status">
        {t.premium.successPending}
      </p>
      <div className="mt-6 flex justify-center">
        <RefreshButton>{t.premium.successCheck}</RefreshButton>
      </div>
    </>
  );
}

export default function PremiumSuccessPage() {
  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-lg rounded-3xl border border-line bg-surface/80 p-8 text-center">
        <Suspense fallback={<Skeleton className="mx-auto h-44 w-full rounded-2xl" />}>
          <Status />
        </Suspense>
      </div>
    </div>
  );
}

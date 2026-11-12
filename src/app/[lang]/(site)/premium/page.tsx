import { Check, Crown, Minus, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutButton } from "@/components/premium/billing-buttons";
import { ButtonLink } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, formatMoney } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPlans } from "@/lib/data/catalog";
import type { PlanData } from "@/lib/data/types";
import { arePaymentsEnabled, priceIdForPlan } from "@/lib/payments";
import { cn } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return pageMetadata({ locale, path: "/premium", title: t.premium.title, description: t.premium.subtitle });
}

/** Кнопка тарифа зависит от сессии и статуса подписки — проверяется на сервере. */
async function PlanAction({ plan, featured, t, locale }: { plan: PlanData; featured: boolean; t: Dictionary; locale: Locale }) {
  const user = await getCurrentUser();
  if (user?.isPremium) {
    return (
      <ButtonLink href="/account/subscription" variant="secondary" size="lg" className="w-full">
        {user.subscription?.plan_id === plan.id ? t.premium.currentPlan : t.account.subscription.manage}
      </ButtonLink>
    );
  }
  if (!arePaymentsEnabled() || !priceIdForPlan(plan.id)) {
    return (
      <p role="status" className="rounded-xl border border-line bg-white/5 px-4 py-3 text-center text-sm text-muted">
        {t.premium.unavailableText}
      </p>
    );
  }
  if (!user) {
    return (
      <ButtonLink href={`/login?next=${encodeURIComponent(`/${locale}/premium`)}`} variant={featured ? "gold" : "secondary"} size="lg" className="w-full" prefetch={false}>
        {t.premium.loginToSubscribe}
      </ButtonLink>
    );
  }
  return (
    <CheckoutButton planId={plan.id} variant={featured ? "gold" : "secondary"} className="w-full">
      {t.premium.choose}
    </CheckoutButton>
  );
}

export default async function PremiumPage() {
  const { locale, t } = await getI18n();
  const plans = await getPlans(locale);
  const monthly = plans.find((plan) => plan.billingPeriod === "month");
  const features: { label: string; free: boolean }[] = [
    { label: t.premium.features.catalog, free: true },
    { label: t.premium.features.freeEpisodes, free: true },
    { label: t.premium.features.lists, free: true },
    { label: t.premium.features.exclusive, free: false },
    { label: t.premium.features.quality, free: false },
    { label: t.premium.features.badge, free: false },
    { label: t.premium.features.noAds, free: false },
    { label: t.premium.features.support, free: false },
  ];

  return (
    <div className="container-page py-10 sm:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-night shadow-[0_18px_50px_-12px_rgb(251_191_36/0.6)]">
          <Crown className="size-8" aria-hidden />
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
          ANIMEVERSE <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">Premium</span>
        </h1>
        <p className="mt-4 text-base text-muted sm:text-lg">{t.premium.subtitle}</p>
      </header>

      <section aria-labelledby="plans-title" className="mx-auto mt-12 max-w-3xl">
        <h2 id="plans-title" className="sr-only">
          {t.premium.plansTitle}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {plans.map((plan) => {
            const yearly = plan.billingPeriod === "year";
            const saving = yearly && monthly && monthly.priceCents > 0 ? Math.round((1 - plan.priceCents / (monthly.priceCents * 12)) * 100) : 0;
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-3xl border p-6 sm:p-7",
                  yearly ? "border-gold/50 bg-gradient-to-b from-amber-400/12 to-surface/80 shadow-[0_24px_60px_-28px_rgb(251_191_36/0.55)]" : "border-line bg-surface/80",
                )}
              >
                {saving > 0 ? (
                  <span className="absolute -top-3 right-6 rounded-full bg-gold px-3 py-1 text-xs font-bold text-night">{fmt(t.premium.save, { percent: saving })}</span>
                ) : null}
                <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-bold">{formatMoney(locale, plan.priceCents, plan.currency)}</span>
                  <span className="text-sm text-muted">{yearly ? t.premium.perYear : t.premium.perMonth}</span>
                </p>
                <div className="mt-6">
                  <Suspense fallback={<Skeleton className="h-13 w-full rounded-xl" />}>
                    <PlanAction plan={plan} featured={yearly} t={t} locale={locale} />
                  </Suspense>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-5 flex items-start justify-center gap-2 text-center text-xs text-dim">
          <ShieldCheck className="mt-px size-4 shrink-0" aria-hidden />
          <span>
            {t.premium.securePayment} {t.premium.cancelAnytime}
          </span>
        </p>
      </section>

      <section aria-labelledby="features-title" className="mx-auto mt-14 max-w-3xl">
        <h2 id="features-title" className="mb-5 text-center font-display text-2xl font-semibold">
          {t.premium.featuresTitle}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface/80">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="px-4 py-3.5 font-medium text-dim sm:px-6">{t.premium.feature}</th>
                <th scope="col" className="w-24 px-2 py-3.5 text-center font-medium text-dim">{t.common.free}</th>
                <th scope="col" className="w-24 px-2 py-3.5 text-center font-semibold text-gold">{t.common.premium}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {features.map((feature) => (
                <tr key={feature.label}>
                  <th scope="row" className="px-4 py-3.5 text-left font-normal sm:px-6">{feature.label}</th>
                  <td className="px-2 py-3.5 text-center">
                    {feature.free ? <Check className="mx-auto size-5 text-success" aria-label={t.common.yes} /> : <Minus className="mx-auto size-5 text-dim" aria-label={t.common.no} />}
                  </td>
                  <td className="px-2 py-3.5 text-center">
                    <Check className="mx-auto size-5 text-gold" aria-label={t.common.yes} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="mx-auto mt-14 max-w-3xl">
        <h2 id="faq-title" className="mb-5 text-center font-display text-2xl font-semibold">
          {t.premium.faqTitle}
        </h2>
        <div className="space-y-2.5">
          {(
            [
              [t.premium.faq.q1, t.premium.faq.a1],
              [t.premium.faq.q2, t.premium.faq.a2],
              [t.premium.faq.q3, t.premium.faq.a3],
            ] as const
          ).map(([question, answer]) => (
            <details key={question} className="group rounded-2xl border border-line bg-surface/80 px-5 py-4 open:border-brand/40">
              <summary className="flex list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {question}
                <span aria-hidden className="text-xl text-dim transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

import { Crown, ExternalLink, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PortalButton } from "@/components/premium/billing-buttons";
import { ButtonLink } from "@/components/ui/link";
import { Badge, Card, Skeleton } from "@/components/ui/misc";
import { fmt, formatDate, formatMoney } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { getPlans } from "@/lib/data/catalog";
import { getPayments } from "@/lib/data/library";
import { arePaymentsEnabled } from "@/lib/payments";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.subscription.title };
}

async function Content() {
  const { locale, t } = await getI18n();
  const user = await requireUser(locale, `/${locale}/account/subscription`);
  const [payments, plans] = await Promise.all([getPayments(), getPlans(locale)]);
  const copy = t.account.subscription;
  const subscription = user.subscription;
  const plan = plans.find((item) => item.id === subscription?.plan_id);
  const endDate = subscription ? formatDate(locale, subscription.current_period_end) : "";
  const paymentTone = { pending: "neutral", succeeded: "success", failed: "danger", refunded: "sky" } as const;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">{copy.title}</h1>

      <Card className={user.isPremium ? "border-gold/30 bg-gradient-to-br from-amber-400/10 via-surface/80 to-surface/80" : undefined}>
        <p className="text-xs font-semibold tracking-wide text-dim uppercase">{copy.currentPlan}</p>
        {user.isPremium && subscription ? (
          <>
            <p className="mt-2 flex flex-wrap items-center gap-2 font-display text-2xl font-semibold">
              <Crown className="size-6 text-gold" aria-hidden />
              {plan?.name ?? t.common.premium}
              <Badge tone="gold">{copy.statuses[subscription.status]}</Badge>
            </p>
            <p className="mt-2 text-sm text-muted">
              {subscription.provider === "manual"
                ? `${copy.grantedByAdmin}. ${fmt(copy.expiresOn, { date: endDate })}`
                : subscription.cancel_at_period_end
                  ? fmt(copy.cancelScheduled, { date: endDate })
                  : fmt(copy.renewsOn, { date: endDate })}
            </p>
            {subscription.provider === "stripe" ? (
              <div className="mt-5">
                <PortalButton>
                  <ExternalLink className="size-4" aria-hidden />
                  {copy.manage}
                </PortalButton>
                <p className="mt-2 text-xs text-dim">{copy.manageHint}</p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-2 font-display text-2xl font-semibold">{copy.freePlan}</p>
            <p className="mt-2 text-sm text-muted">{copy.freeText}</p>
            {subscription?.status === "past_due" ? (
              <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p>{copy.pastDue}</p>
                  {arePaymentsEnabled() ? (
                    <div className="mt-3">
                      <PortalButton size="sm">{copy.manage}</PortalButton>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <ButtonLink href="/premium" variant="gold" className="mt-5">
                <Crown className="size-4" aria-hidden />
                {copy.upgrade}
              </ButtonLink>
            )}
          </>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">{copy.paymentsTitle}</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{copy.noPayments}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs text-dim uppercase">
                <tr>
                  <th scope="col" className="pb-2 font-medium">{copy.date}</th>
                  <th scope="col" className="pb-2 font-medium">{copy.description}</th>
                  <th scope="col" className="pb-2 font-medium">{copy.amount}</th>
                  <th scope="col" className="pb-2 font-medium">{copy.status}</th>
                  <th scope="col" className="pb-2 font-medium">{copy.receipt}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-3 whitespace-nowrap">{formatDate(locale, payment.paid_at ?? payment.created_at)}</td>
                    <td className="py-3 text-muted">{payment.description ?? "—"}</td>
                    <td className="py-3 font-medium whitespace-nowrap">{formatMoney(locale, payment.amount_cents, payment.currency)}</td>
                    <td className="py-3">
                      <Badge tone={paymentTone[payment.status]}>{copy.paymentStatuses[payment.status]}</Badge>
                    </td>
                    <td className="py-3">
                      {payment.receipt_url ? (
                        <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-soft hover:underline">
                          {copy.receipt}
                          <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <Content />
    </Suspense>
  );
}

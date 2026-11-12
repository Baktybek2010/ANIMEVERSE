import { PlanForm } from "@/components/admin/content-managers";
import { AdminHeader, EmptyRow, TableWrap } from "@/components/admin/ui";
import { RevokeButton } from "@/components/admin/user-controls";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Link } from "@/components/ui/link";
import { Badge, Card } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { localizePath } from "@/i18n/config";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { fmt, formatDate, formatDateTime, formatMoney } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getAdminSubscriptions, parsePage } from "@/lib/data/admin";
import { isStripeConfigured } from "@/lib/env.server";

const STATUSES = ["active", "trialing", "past_due", "canceled", "expired", "incomplete"] as const;

export default async function AdminSubscriptionsPage({ searchParams }: PageProps<"/[lang]/admin/subscriptions">) {
  const [{ locale, t }, params] = await Promise.all([getI18n(), searchParams]);
  const a = await getAdminDictionary(locale);
  await requirePermission(locale, "subscriptions.manage");
  const status = typeof params.status === "string" ? params.status : "";
  const page = parsePage(params.page);
  const data = await getAdminSubscriptions({ status, page });
  const paymentsOn = isStripeConfigured();

  return (
    <>
      <AdminHeader title={a.subscriptions.title} description={fmt(a.common.total, { count: data.total })} />
      <p role="status" className={`mb-4 rounded-xl border px-4 py-3 text-sm ${paymentsOn ? "border-emerald-400/30 bg-emerald-400/10 text-success" : "border-gold/30 bg-gold/10 text-gold"}`}>
        {paymentsOn ? a.subscriptions.paymentsOn : a.subscriptions.paymentsOff}
      </p>
      <form action={localizePath(locale, "/admin/subscriptions")} method="get" className="mb-4 flex gap-2">
        <Select name="status" defaultValue={status} aria-label={a.users.status} className="w-auto min-w-52">
          <option value="">{a.subscriptions.all}</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {t.account.subscription.statuses[item]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          {t.common.apply}
        </Button>
      </form>
      <TableWrap>
        <thead>
          <tr>
            <th scope="col">{a.users.user}</th>
            <th scope="col">{a.subscriptions.plan}</th>
            <th scope="col">{a.users.status}</th>
            <th scope="col">{a.subscriptions.provider}</th>
            <th scope="col">{a.subscriptions.period}</th>
            <th scope="col" className="text-right">{a.common.actions}</th>
          </tr>
        </thead>
        <tbody>
          {data.items.length === 0 ? <EmptyRow colSpan={6} text={a.common.noData} /> : null}
          {data.items.map((sub) => (
            <tr key={sub.id}>
              <td>
                <Link href={`/admin/users/${sub.user_id}`} className="font-medium hover:text-brand-soft">
                  @{sub.user?.username ?? "—"}
                </Link>
                <span className="block text-xs text-dim">{sub.user?.email}</span>
              </td>
              <td>{data.plans.find((plan) => plan.id === sub.plan_id)?.[`name_${locale}`] ?? sub.plan_id}</td>
              <td>
                <Badge tone={sub.status === "active" || sub.status === "trialing" ? "gold" : sub.status === "past_due" ? "danger" : "neutral"}>
                  {t.account.subscription.statuses[sub.status]}
                </Badge>
              </td>
              <td className="text-muted">{sub.provider === "manual" ? a.subscriptions.manual : a.subscriptions.stripe}</td>
              <td className="whitespace-nowrap text-xs text-dim">
                {formatDate(locale, sub.current_period_start)} — {formatDate(locale, sub.current_period_end)}
              </td>
              <td className="text-right">
                {sub.provider === "manual" && ["active", "trialing"].includes(sub.status) ? <RevokeButton subscriptionId={sub.id} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <div className="mt-6">
        <Pagination page={page} totalPages={data.totalPages} basePath="/admin/subscriptions" query={{ status: status || undefined }} labels={{ previous: t.common.previous, next: t.common.next, pageOf: fmt(t.common.pageOf, { page, total: data.totalPages }) }} />
      </div>

      <h2 className="mt-10 mb-3 font-display text-lg font-semibold">{a.subscriptions.paymentsTitle}</h2>
      <TableWrap>
        <tbody>
          {data.payments.length === 0 ? <EmptyRow colSpan={4} text={t.account.subscription.noPayments} /> : null}
          {data.payments.map((payment) => (
            <tr key={payment.id}>
              <td className="whitespace-nowrap">{formatDateTime(locale, payment.created_at)}</td>
              <td>@{payment.user?.username ?? "—"}</td>
              <td className="font-medium">{formatMoney(locale, payment.amount_cents, payment.currency)}</td>
              <td>
                <Badge tone={payment.status === "succeeded" ? "success" : payment.status === "failed" ? "danger" : "neutral"}>
                  {t.account.subscription.paymentStatuses[payment.status]}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Card className="mt-10">
        <h2 className="font-display text-lg font-semibold">{a.subscriptions.plansTitle}</h2>
        <p className="mt-1 mb-4 text-sm text-muted">{a.subscriptions.planHint}</p>
        <div className="space-y-4">
          {data.plans.map((plan) => (
            <PlanForm
              key={`${plan.id}-${plan.updated_at}`}
              plan={{ id: plan.id, name_ru: plan.name_ru, name_en: plan.name_en, name_ja: plan.name_ja, price_cents: String(plan.price_cents), currency: plan.currency, is_active: plan.is_active }}
            />
          ))}
        </div>
      </Card>
    </>
  );
}

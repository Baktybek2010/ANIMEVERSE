import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { AdminHeader, TableWrap } from "@/components/admin/ui";
import { RevokeButton, UserControls } from "@/components/admin/user-controls";
import { Link } from "@/components/ui/link";
import { Avatar, Badge, Card } from "@/components/ui/misc";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { fmt, formatDate, formatDateTime, formatMoney } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { assignableRoles, can, canModerateUser } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { getAdminUser } from "@/lib/data/admin";
import { getPlans } from "@/lib/data/catalog";
import { uuidSchema } from "@/lib/validation/admin";

export default async function AdminUserPage({ params }: PageProps<"/[lang]/admin/users/[id]">) {
  const [{ locale, t }, { id }] = await Promise.all([getI18n(), params]);
  const a = await getAdminDictionary(locale);
  const actor = await requirePermission(locale, "users.view");
  if (!uuidSchema.safeParse(id).success) notFound();
  const [data, plans] = await Promise.all([getAdminUser(id), getPlans(locale)]);
  if (!data) notFound();
  const { profile, subscriptions, payments } = data;
  const isSelf = profile.id === actor.id;
  const canManage = can(actor.role, "users.manage") && !isSelf;
  const live = subscriptions.find((sub) => ["active", "trialing", "past_due"].includes(sub.status));

  return (
    <>
      <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-soft hover:underline">
        <ChevronLeft className="size-4" aria-hidden />
        {a.users.title}
      </Link>
      <AdminHeader title={a.users.profile} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar src={profile.avatar_url} name={profile.display_name || profile.username} size={72} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold">
                  {profile.display_name || profile.username}
                  <Badge tone={profile.role === "user" ? "neutral" : "brand"}>{t.roles[profile.role]}</Badge>
                  <Badge tone={profile.is_banned ? "danger" : "success"}>{profile.is_banned ? a.users.banned : a.users.active}</Badge>
                  {isSelf ? <Badge tone="sky">{a.users.self}</Badge> : null}
                </p>
                <p className="mt-1 truncate text-sm text-muted">
                  @{profile.username} · {profile.email}
                </p>
                <p className="mt-1 text-xs text-dim">
                  {a.users.registered}: {formatDate(locale, profile.created_at)}
                </p>
              </div>
            </div>
            {profile.bio ? <p className="mt-4 text-sm text-muted">{profile.bio}</p> : null}
            {profile.is_banned && profile.banned_reason ? (
              <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
                {a.users.banReason}: {profile.banned_reason}
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg font-semibold">{a.users.subscription}</h2>
            {subscriptions.length === 0 ? (
              <p className="text-sm text-muted">{a.users.noSubscription}</p>
            ) : (
              <ul className="divide-y divide-line">
                {subscriptions.map((sub) => (
                  <li key={sub.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                    <span className="font-medium">{plans.find((plan) => plan.id === sub.plan_id)?.name ?? sub.plan_id}</span>
                    <Badge tone={sub.status === "active" || sub.status === "trialing" ? "gold" : sub.status === "past_due" ? "danger" : "neutral"}>
                      {t.account.subscription.statuses[sub.status]}
                    </Badge>
                    <Badge>{sub.provider === "manual" ? a.subscriptions.manual : a.subscriptions.stripe}</Badge>
                    <span className="text-xs text-dim">{fmt(a.subscriptions.until, { date: formatDate(locale, sub.current_period_end) })}</span>
                    {canManage && can(actor.role, "subscriptions.manage") && sub.provider === "manual" && sub.id === live?.id ? (
                      <span className="ml-auto">
                        <RevokeButton subscriptionId={sub.id} />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {payments.length > 0 ? (
            <div>
              <h2 className="mb-3 font-display text-lg font-semibold">{a.users.payments}</h2>
              <TableWrap>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="whitespace-nowrap">{formatDateTime(locale, payment.created_at)}</td>
                      <td className="text-muted">{payment.description ?? "—"}</td>
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
            </div>
          ) : null}
        </div>

        <Card className="h-fit">
          <h2 className="mb-4 font-display text-lg font-semibold">{a.common.actions}</h2>
          {canManage ? (
            <UserControls
              userId={profile.id}
              role={profile.role}
              isBanned={profile.is_banned}
              assignableRoles={assignableRoles(actor.role, profile.role)}
              canModerate={canModerateUser(actor.role, profile.role)}
              canGrant={can(actor.role, "subscriptions.manage") && !live}
              plans={plans.map((plan) => ({ id: plan.id, name: plan.name }))}
            />
          ) : (
            <p className="text-sm text-muted">{isSelf ? a.users.self : a.users.cannotModify}</p>
          )}
        </Card>
      </div>
    </>
  );
}

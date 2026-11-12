"use client";

import { Ban, Crown, ShieldCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { useAdminI18n } from "@/i18n/admin-client";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { grantSubscriptionAction, revokeSubscriptionAction, setUserBanAction, setUserRoleAction } from "@/lib/actions/admin/users";
import type { Role } from "@/lib/auth/roles";
import { useRun } from "./use-run";

type Props = {
  userId: string;
  role: Role;
  isBanned: boolean;
  /** Роли, которые текущий администратор вправе назначить (вычислено на сервере). */
  assignableRoles: Role[];
  canModerate: boolean;
  canGrant: boolean;
  plans: { id: string; name: string }[];
};

export function UserControls({ userId, role, isBanned, assignableRoles, canModerate, canGrant, plans }: Props) {
  const a = useAdminI18n();
  const { t } = useI18n();
  const { run, pending, errorOf } = useRun();
  const [nextRole, setNextRole] = useState<Role>(role);
  const [banOpen, setBanOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [grantOpen, setGrantOpen] = useState(false);
  const [grant, setGrant] = useState({ plan: plans[0]?.id ?? "", days: "30" });

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">{a.users.changeRole}</h3>
        {assignableRoles.length > 0 ? (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              <Select value={nextRole} onChange={(event) => setNextRole(event.target.value as Role)} aria-label={a.users.role} className="w-auto min-w-52">
                {[...new Set([role, ...assignableRoles])].map((item) => (
                  <option key={item} value={item}>
                    {t.roles[item]}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" loading={pending} disabled={nextRole === role} onClick={() => run(() => setUserRoleAction(userId, nextRole), { success: a.users.roleChanged })}>
                <ShieldCheck className="size-4" aria-hidden />
                {t.common.apply}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-dim">{a.users.roleHint}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">{a.users.cannotModify}</p>
        )}
      </div>

      {canModerate ? (
        <div className="flex flex-wrap gap-2 border-t border-line pt-5">
          {isBanned ? (
            <Button variant="secondary" loading={pending} onClick={() => run(() => setUserBanAction(userId, { banned: false, reason: "" }), { success: a.users.unbannedDone })}>
              <Undo2 className="size-4" aria-hidden />
              {a.users.unban}
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setBanOpen(true)}>
              <Ban className="size-4" aria-hidden />
              {a.users.ban}
            </Button>
          )}
          {canGrant && plans.length > 0 ? (
            <Button variant="gold" onClick={() => setGrantOpen(true)}>
              <Crown className="size-4" aria-hidden />
              {a.users.grant}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={banOpen}
        onClose={() => setBanOpen(false)}
        title={a.users.ban}
        description={a.users.banText}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setBanOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              onClick={async () => {
                if (await run(() => setUserBanAction(userId, { banned: true, reason }), { success: a.users.bannedDone })) setBanOpen(false);
              }}
            >
              {a.users.ban}
            </Button>
          </>
        }
      >
        <Field label={a.users.banReason} htmlFor="ban-reason" error={errorOf("reason")}>
          <Textarea id="ban-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </Dialog>

      <Dialog
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        title={a.users.grant}
        description={a.users.grantText}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setGrantOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="gold"
              size="sm"
              loading={pending}
              onClick={async () => {
                if (await run(() => grantSubscriptionAction(userId, grant), { success: a.users.granted })) setGrantOpen(false);
              }}
            >
              {a.users.grant}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={a.users.grantPlan} htmlFor="grant-plan">
            <Select id="grant-plan" value={grant.plan} onChange={(event) => setGrant({ ...grant, plan: event.target.value })}>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={a.users.grantDays} htmlFor="grant-days" error={errorOf("days")}>
            <Input id="grant-days" type="number" min={1} max={3650} value={grant.days} onChange={(event) => setGrant({ ...grant, days: event.target.value })} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

export function RevokeButton({ subscriptionId }: { subscriptionId: string }) {
  const a = useAdminI18n();
  const { run } = useRun();
  return (
    <ConfirmButton
      title={a.users.revoke}
      description={a.common.confirmDeleteText}
      confirmLabel={a.users.revoke}
      onConfirm={async () => {
        await run(() => revokeSubscriptionAction(subscriptionId), { success: a.users.revoked });
      }}
    >
      {a.users.revoke}
    </ConfirmButton>
  );
}

"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { banSchema, grantSchema, roleSchema, uuidSchema } from "@/lib/validation/admin";
import { authorize } from "../guard";
import { type ActionResult, type ErrorKey, fail, mapDbError, ok, validationFail } from "../result";

function rpcError(error: { code?: string; message?: string }): ErrorKey {
  if (/subscription_already_active/.test(error.message ?? "")) return "alreadySubscribed";
  return mapDbError(error);
}

/**
 * Смена роли. Иерархию проверяет SQL-функция admin_set_user_role (SECURITY DEFINER):
 * нельзя менять свою роль, трогать равных/старших и назначать роль не ниже своей.
 */
export async function setUserRoleAction(userId: unknown, role: unknown): Promise<ActionResult> {
  const { denied } = await authorize("users.manage");
  if (denied) return denied;
  const id = uuidSchema.safeParse(userId);
  const parsedRole = roleSchema.safeParse(role);
  if (!id.success || !parsedRole.success) return fail("validation");
  const db = await createClient();
  const { error } = await db.rpc("admin_set_user_role", { p_user: id.data, p_role: parsedRole.data });
  if (error) return fail(rpcError(error));
  return ok();
}

export async function setUserBanAction(userId: unknown, input: unknown): Promise<ActionResult> {
  const { denied } = await authorize("users.manage");
  if (denied) return denied;
  const id = uuidSchema.safeParse(userId);
  if (!id.success) return fail("validation");
  const parsed = banSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const db = await createClient();
  const { error } = await db.rpc("admin_set_user_ban", {
    p_user: id.data,
    p_banned: parsed.data.banned,
    p_reason: parsed.data.reason || undefined,
  });
  if (error) return fail(rpcError(error));

  // Дополнительно блокируем вход на уровне Supabase Auth: новые токены не выдаются.
  const admin = getAdminClient();
  if (admin) {
    await admin.auth.admin.updateUserById(id.data, { ban_duration: parsed.data.banned ? "876000h" : "none" });
  }
  return ok();
}

/** Ручная выдача Premium (без платежа, с записью в журнал). */
export async function grantSubscriptionAction(userId: unknown, input: unknown): Promise<ActionResult> {
  const { denied } = await authorize("subscriptions.manage");
  if (denied) return denied;
  const id = uuidSchema.safeParse(userId);
  if (!id.success) return fail("validation");
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const db = await createClient();
  const { error } = await db.rpc("admin_grant_subscription", { p_user: id.data, p_plan: parsed.data.plan, p_days: parsed.data.days });
  if (error) return fail(rpcError(error));
  return ok();
}

export async function revokeSubscriptionAction(subscriptionId: unknown): Promise<ActionResult> {
  const { denied } = await authorize("subscriptions.manage");
  if (denied) return denied;
  const id = uuidSchema.safeParse(subscriptionId);
  if (!id.success) return fail("validation");
  const db = await createClient();
  const { error } = await db.rpc("admin_revoke_subscription", { p_subscription: id.data });
  if (error) return fail(rpcError(error));
  return ok();
}

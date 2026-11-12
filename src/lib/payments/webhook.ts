import type { SubscriptionStatus } from "@/lib/auth/subscription";
import type { DbClient } from "@/lib/supabase/types";
import type { StripeClient, StripeEvent, StripeSubscription } from "./stripe";

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  unpaid: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "expired",
  paused: "canceled",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function isoFromUnix(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

/** Границы периода: в новых версиях API они перенесены на позиции подписки. */
export function subscriptionPeriod(subscription: StripeSubscription): { start: string | null; end: string | null } {
  const item = subscription.items?.data?.[0];
  return {
    start: isoFromUnix(subscription.current_period_start ?? item?.current_period_start),
    end: isoFromUnix(subscription.current_period_end ?? item?.current_period_end),
  };
}

export type WebhookOutcome = { handled: boolean; duplicate?: boolean; note?: string };

const isLive = (status: string | null) => status === "active" || status === "trialing";

/**
 * Создаёт или обновляет подписку пользователя по данным Stripe.
 * Уведомление об активации отправляется один раз — при переходе в действующий статус,
 * каким бы событием он ни был вызван.
 */
async function upsertSubscription(db: DbClient, subscription: StripeSubscription, fallback: { userId?: string | null; planId?: string | null } = {}) {
  const result = await writeSubscription(db, subscription, fallback);
  if (isLive(result.status) && !isLive(result.previousStatus)) {
    await db.from("notifications").insert({ user_id: result.userId, type: "premium_activated", link: "/account/subscription" });
  }
  return result;
}

async function writeSubscription(db: DbClient, subscription: StripeSubscription, fallback: { userId?: string | null; planId?: string | null } = {}) {
  const status = STATUS_MAP[subscription.status] ?? "incomplete";
  const period = subscriptionPeriod(subscription);

  const { data: existing } = await db
    .from("subscriptions")
    .select("id, user_id, status")
    .eq("provider", "stripe")
    .eq("provider_subscription_id", subscription.id)
    .maybeSingle();

  const patch = {
    status,
    provider_customer_id: subscription.customer,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    canceled_at: isoFromUnix(subscription.canceled_at),
    ...(period.start ? { current_period_start: period.start } : {}),
    ...(period.end ? { current_period_end: period.end } : {}),
  };

  if (existing) {
    const { error } = await db.from("subscriptions").update(patch).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id, userId: existing.user_id, previousStatus: existing.status, status, created: false };
  }

  const userId = str(subscription.metadata?.user_id) ?? fallback.userId ?? null;
  const planId = str(subscription.metadata?.plan_id) ?? fallback.planId ?? null;
  if (!userId || !UUID.test(userId) || !planId || !period.end) {
    throw new Error(`Subscription ${subscription.id}: missing user/plan metadata or period`);
  }

  // У пользователя может быть только одна действующая подписка: выданная вручную уступает оплаченной.
  if (status === "active" || status === "trialing" || status === "past_due") {
    await db
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("status", ["trialing", "active", "past_due"]);
  }

  const { data: inserted, error } = await db
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan_id: planId,
      provider: "stripe",
      provider_subscription_id: subscription.id,
      current_period_start: period.start ?? new Date().toISOString(),
      current_period_end: period.end,
      ...patch,
    })
    .select("id")
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "subscription insert failed");
  return { id: inserted.id, userId, previousStatus: null, status, created: true };
}

function invoiceSubscriptionId(invoice: Record<string, unknown>): string | null {
  const direct = invoice.subscription;
  if (typeof direct === "string") return direct;
  const parent = invoice.parent as { subscription_details?: { subscription?: unknown } } | undefined;
  return str(parent?.subscription_details?.subscription);
}

async function recordInvoice(db: DbClient, stripe: StripeClient, invoice: Record<string, unknown>, status: "succeeded" | "failed") {
  const invoiceId = str(invoice.id);
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!invoiceId || !subscriptionId) return null;

  const find = () =>
    db
      .from("subscriptions")
      .select("id, user_id")
      .eq("provider", "stripe")
      .eq("provider_subscription_id", subscriptionId)
      .maybeSingle();
  let { data: subscription } = await find();
  if (!subscription) {
    // Счёт может прийти раньше события о создании подписки — создаём её по данным Stripe.
    await upsertSubscription(db, await stripe.retrieveSubscription(subscriptionId));
    ({ data: subscription } = await find());
  }
  if (!subscription) return null;

  const amount = typeof invoice.amount_paid === "number" && status === "succeeded" ? invoice.amount_paid : invoice.amount_due;
  const transitions = invoice.status_transitions as { paid_at?: number } | undefined;
  const receipt = str(invoice.hosted_invoice_url);
  const { error } = await db.from("payments").upsert(
    {
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      provider: "stripe",
      provider_payment_id: invoiceId,
      amount_cents: typeof amount === "number" ? Math.max(0, Math.round(amount)) : 0,
      currency: (str(invoice.currency) ?? "usd").toLowerCase(),
      status,
      description: str(invoice.number),
      receipt_url: receipt?.startsWith("https://") ? receipt : null,
      paid_at: status === "succeeded" ? (isoFromUnix(transitions?.paid_at) ?? new Date().toISOString()) : null,
    },
    { onConflict: "provider,provider_payment_id" },
  );
  if (error) throw new Error(error.message);
  return subscription;
}

/**
 * Обработка проверенного события Stripe. Вызывать только после verifyStripeWebhook.
 * Идемпотентность обеспечивает таблица payment_events (первичный ключ — id события).
 */
export async function handleStripeEvent(db: DbClient, stripe: StripeClient, event: StripeEvent): Promise<WebhookOutcome> {
  const { error: lockError } = await db
    .from("payment_events")
    .insert({ id: event.id, provider: "stripe", type: event.type, payload: JSON.parse(JSON.stringify(event)) });
  if (lockError) {
    if (lockError.code === "23505") return { handled: true, duplicate: true };
    throw new Error(lockError.message);
  }

  try {
    const object = event.data.object;
    switch (event.type) {
      case "checkout.session.completed": {
        const subscriptionId = str(object.subscription);
        if (object.mode !== "subscription" || !subscriptionId) return { handled: false, note: "not a subscription checkout" };
        const metadata = (object.metadata ?? {}) as Record<string, string>;
        const subscription = await stripe.retrieveSubscription(subscriptionId);
        await upsertSubscription(db, subscription, {
          userId: str(metadata.user_id) ?? str(object.client_reference_id),
          planId: str(metadata.plan_id),
        });
        return { handled: true };
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = object as unknown as StripeSubscription;
        const result = await upsertSubscription(db, subscription);
        if (!result.created && subscription.cancel_at_period_end && event.type === "customer.subscription.updated") {
          const previous = (event.data as { previous_attributes?: { cancel_at_period_end?: boolean } }).previous_attributes;
          if (previous?.cancel_at_period_end === false) {
            await db.from("notifications").insert({ user_id: result.userId, type: "premium_canceled", link: "/account/subscription" });
          }
        } else if (!result.created && result.status === "canceled" && result.previousStatus !== "canceled") {
          await db.from("notifications").insert({ user_id: result.userId, type: "premium_expired", link: "/premium" });
        }
        return { handled: true };
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        await recordInvoice(db, stripe, object, "succeeded");
        return { handled: true };
      }
      case "invoice.payment_failed": {
        const subscription = await recordInvoice(db, stripe, object, "failed");
        if (subscription) {
          await db.from("notifications").insert({ user_id: subscription.user_id, type: "payment_failed", link: "/account/subscription" });
        }
        return { handled: true };
      }
      case "charge.refunded": {
        const invoiceId = str(object.invoice);
        if (invoiceId) {
          await db.from("payments").update({ status: "refunded" }).eq("provider", "stripe").eq("provider_payment_id", invoiceId);
        }
        return { handled: true };
      }
      default:
        return { handled: false, note: "ignored event type" };
    }
  } catch (error) {
    // Снимаем отметку об обработке, чтобы повторная доставка события была обработана заново.
    await db.from("payment_events").delete().eq("id", event.id);
    throw error;
  }
}

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StripeClient, StripeEvent, StripeSubscription } from "@/lib/payments/stripe";
import { handleStripeEvent } from "@/lib/payments/webhook";
import { adminClient, cleanupTestUsers, createTestUser, hasLocalSupabase, RUN_ID, type TestUser } from "../helpers/supabase";

/** Полный жизненный цикл платной подписки через обработчик webhook на реальной базе. */
describe.skipIf(!hasLocalSupabase)("платежи: обработка событий Stripe", () => {
  const db = adminClient();
  let user: TestUser;
  const subscriptionId = `sub_${RUN_ID}`;
  const customerId = `cus_${RUN_ID}`;
  const now = Math.floor(Date.now() / 1000);
  let remote: StripeSubscription;

  // Провайдер подменён: сеть не используется, проверяется только наша логика и база данных.
  const stripe = { retrieveSubscription: async () => remote } as unknown as StripeClient;
  const event = (id: string, type: string, object: Record<string, unknown>, extra: Record<string, unknown> = {}): StripeEvent =>
    ({ id: `evt_${RUN_ID}_${id}`, type, created: now, data: { object, ...extra } }) as StripeEvent;

  beforeAll(async () => {
    user = await createTestUser("user", "payer");
    remote = {
      id: subscriptionId,
      status: "active",
      customer: customerId,
      cancel_at_period_end: false,
      canceled_at: null,
      current_period_start: now - 60,
      current_period_end: now + 30 * 86400,
      metadata: { user_id: user.id, plan_id: "premium_monthly" },
    };
  });

  afterAll(async () => {
    await db.from("payment_events").delete().like("id", `evt_${RUN_ID}_%`);
    await cleanupTestUsers();
  });

  it("до оплаты у пользователя нет Premium", async () => {
    expect((await user.client.rpc("is_premium")).data).toBe(false);
  });

  it("счёт, пришедший раньше события оформления, создаёт подписку и платёж", async () => {
    const outcome = await handleStripeEvent(
      db,
      stripe,
      event("invoice", "invoice.paid", {
        id: `in_${RUN_ID}_1`, subscription: subscriptionId, amount_paid: 499, currency: "usd", number: "INV-0001",
        hosted_invoice_url: "https://invoice.stripe.com/i/test", status_transitions: { paid_at: now },
      }),
    );
    expect(outcome.handled).toBe(true);
    const { data: payments } = await user.client.from("payments").select("amount_cents, currency, status, receipt_url");
    expect(payments).toEqual([{ amount_cents: 499, currency: "usd", status: "succeeded", receipt_url: "https://invoice.stripe.com/i/test" }]);
  });

  it("подтверждённая оплата активирует Premium", async () => {
    const outcome = await handleStripeEvent(
      db,
      stripe,
      event("checkout", "checkout.session.completed", {
        id: "cs_test", mode: "subscription", subscription: subscriptionId, customer: customerId,
        client_reference_id: user.id, metadata: { user_id: user.id, plan_id: "premium_monthly" },
      }),
    );
    expect(outcome.handled).toBe(true);
    expect((await user.client.rpc("is_premium")).data).toBe(true);
    const { data: subs } = await user.client.from("subscriptions").select("status, provider, plan_id, provider_customer_id");
    expect(subs).toEqual([{ status: "active", provider: "stripe", plan_id: "premium_monthly", provider_customer_id: customerId }]);
  });

  it("повторная доставка события не обрабатывается дважды", async () => {
    const duplicate = await handleStripeEvent(db, stripe, event("checkout", "checkout.session.completed", { mode: "subscription", subscription: subscriptionId }));
    expect(duplicate).toEqual({ handled: true, duplicate: true });
    const { count } = await db.from("subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    expect(count).toBe(1);
  });

  it("неизвестные типы событий игнорируются", async () => {
    const outcome = await handleStripeEvent(db, stripe, event("other", "customer.created", { id: customerId }));
    expect(outcome.handled).toBe(false);
  });

  it("отключение автопродления сохраняет Premium до конца периода", async () => {
    remote = { ...remote, cancel_at_period_end: true };
    await handleStripeEvent(db, stripe, event("cancel", "customer.subscription.updated", remote as unknown as Record<string, unknown>, { previous_attributes: { cancel_at_period_end: false } }));
    const { data } = await user.client.from("subscriptions").select("cancel_at_period_end, status").single();
    expect(data).toEqual({ cancel_at_period_end: true, status: "active" });
    expect((await user.client.rpc("is_premium")).data).toBe(true);
    const { data: notes } = await user.client.from("notifications").select("type");
    expect(notes?.map((note) => note.type)).toEqual(expect.arrayContaining(["premium_activated", "premium_canceled"]));
  });

  it("неудачное списание фиксируется и не даёт Premium при просрочке", async () => {
    await handleStripeEvent(db, stripe, event("failed", "invoice.payment_failed", { id: `in_${RUN_ID}_2`, subscription: subscriptionId, amount_due: 499, currency: "usd" }));
    remote = { ...remote, status: "past_due" };
    await handleStripeEvent(db, stripe, event("pastdue", "customer.subscription.updated", remote as unknown as Record<string, unknown>));
    expect((await user.client.rpc("is_premium")).data).toBe(false);
    const { data } = await user.client.from("payments").select("status").eq("status", "failed");
    expect(data).toHaveLength(1);
  });

  it("удаление подписки у провайдера завершает её", async () => {
    remote = { ...remote, status: "canceled", canceled_at: now };
    await handleStripeEvent(db, stripe, event("deleted", "customer.subscription.deleted", remote as unknown as Record<string, unknown>));
    const { data } = await user.client.from("subscriptions").select("status").single();
    expect(data?.status).toBe("canceled");
    expect((await user.client.rpc("is_premium")).data).toBe(false);
  });

  it("возврат средств отмечается в истории платежей", async () => {
    await handleStripeEvent(db, stripe, event("refund", "charge.refunded", { id: "ch_1", invoice: `in_${RUN_ID}_1` }));
    const { data } = await user.client.from("payments").select("status").eq("status", "refunded");
    expect(data).toHaveLength(1);
  });

  it("событие без данных пользователя не создаёт подписку и может быть доставлено повторно", async () => {
    const orphan = { ...remote, id: `sub_${RUN_ID}_orphan`, status: "active", metadata: {} };
    const orphanEvent = event("orphan", "customer.subscription.created", orphan as unknown as Record<string, unknown>);
    await expect(handleStripeEvent(db, stripe, orphanEvent)).rejects.toThrow("missing user/plan");
    const { data } = await db.from("payment_events").select("id").eq("id", orphanEvent.id);
    expect(data).toEqual([]);
  });
});

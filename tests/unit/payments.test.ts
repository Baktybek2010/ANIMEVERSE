import { describe, expect, it, vi } from "vitest";
import { createStripeClient, encodeForm, signStripePayload, StripeError, verifyStripeWebhook } from "@/lib/payments/stripe";
import { subscriptionPeriod } from "@/lib/payments/webhook";

const SECRET = "whsec_test_secret";
const NOW = 1_800_000_000;
const body = JSON.stringify({ id: "evt_1", type: "invoice.paid", created: NOW, data: { object: { id: "in_1" } } });

describe("подпись webhook Stripe", () => {
  it("принимает корректную подпись", () => {
    const event = verifyStripeWebhook(body, signStripePayload(body, SECRET, NOW), SECRET, NOW);
    expect(event.id).toBe("evt_1");
    expect(event.type).toBe("invoice.paid");
  });

  it("отклоняет отсутствующую или некорректную подпись", () => {
    expect(() => verifyStripeWebhook(body, null, SECRET, NOW)).toThrow(StripeError);
    expect(() => verifyStripeWebhook(body, "garbage", SECRET, NOW)).toThrow(StripeError);
    expect(() => verifyStripeWebhook(body, `t=${NOW},v1=${"0".repeat(64)}`, SECRET, NOW)).toThrow("Invalid signature");
    expect(() => verifyStripeWebhook(body, `t=${NOW},v1=zz`, SECRET, NOW)).toThrow("Invalid signature");
  });

  it("отклоняет подпись, сделанную другим секретом", () => {
    expect(() => verifyStripeWebhook(body, signStripePayload(body, "whsec_other", NOW), SECRET, NOW)).toThrow("Invalid signature");
  });

  it("отклоняет изменённое тело запроса", () => {
    const signature = signStripePayload(body, SECRET, NOW);
    const tampered = body.replace("in_1", "in_2");
    expect(() => verifyStripeWebhook(tampered, signature, SECRET, NOW)).toThrow("Invalid signature");
  });

  it("отклоняет устаревшую подпись (защита от повторной отправки)", () => {
    const old = signStripePayload(body, SECRET, NOW - 3600);
    expect(() => verifyStripeWebhook(body, old, SECRET, NOW)).toThrow("tolerance");
  });

  it("не работает без настроенного секрета", () => {
    expect(() => verifyStripeWebhook(body, signStripePayload(body, "", NOW), "", NOW)).toThrow("not configured");
  });

  it("отклоняет подписанный, но некорректный JSON", () => {
    const raw = "{not json";
    expect(() => verifyStripeWebhook(raw, signStripePayload(raw, SECRET, NOW), SECRET, NOW)).toThrow("Invalid payload");
    const noType = JSON.stringify({ id: "evt_2" });
    expect(() => verifyStripeWebhook(noType, signStripePayload(noType, SECRET, NOW), SECRET, NOW)).toThrow("Invalid event");
  });
});

describe("клиент Stripe", () => {
  it("кодирует вложенные параметры формы", () => {
    const encoded = encodeForm({ mode: "subscription", line_items: [{ price: "price_1", quantity: 1 }], metadata: { user_id: "u 1" }, skip: undefined });
    expect(encoded).toEqual([
      "mode=subscription",
      "line_items%5B0%5D%5Bprice%5D=price_1",
      "line_items%5B0%5D%5Bquantity%5D=1",
      "metadata%5Buser_id%5D=u%201",
    ]);
  });

  it("создаёт сессию оплаты с метаданными пользователя", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" }), { status: 200 }));
    const stripe = createStripeClient("sk_test_x", fetchMock as unknown as typeof fetch);
    const session = await stripe.createCheckoutSession({
      priceId: "price_1", userId: "user-1", planId: "premium_monthly", email: "a@b.c",
      successUrl: "https://site/ok", cancelUrl: "https://site/cancel",
    });
    expect(session.url).toContain("checkout.stripe.com");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_x");
    const params = new URLSearchParams(init.body as string);
    expect(params.get("mode")).toBe("subscription");
    expect(params.get("client_reference_id")).toBe("user-1");
    expect(params.get("subscription_data[metadata][user_id]")).toBe("user-1");
    expect(params.get("subscription_data[metadata][plan_id]")).toBe("premium_monthly");
    expect(params.get("customer_email")).toBe("a@b.c");
    expect(params.has("customer")).toBe(false);
  });

  it("сообщает об ошибке провайдера", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: "No such price", code: "resource_missing" } }), { status: 400 }));
    const stripe = createStripeClient("sk_test_x", fetchMock as unknown as typeof fetch);
    await expect(stripe.retrieveSubscription("sub_1")).rejects.toMatchObject({ status: 400, code: "resource_missing" });
  });
});

describe("период подписки", () => {
  const base = { id: "sub_1", status: "active", customer: "cus_1", cancel_at_period_end: false, canceled_at: null, metadata: {} };

  it("читает период из подписки (старые версии API)", () => {
    const period = subscriptionPeriod({ ...base, current_period_start: 1_700_000_000, current_period_end: 1_702_592_000 });
    expect(period.end).toBe(new Date(1_702_592_000_000).toISOString());
  });

  it("читает период из позиции подписки (новые версии API)", () => {
    const period = subscriptionPeriod({ ...base, items: { data: [{ current_period_start: 1_700_000_000, current_period_end: 1_702_592_000 }] } });
    expect(period.start).toBe(new Date(1_700_000_000_000).toISOString());
    expect(period.end).toBe(new Date(1_702_592_000_000).toISOString());
  });

  it("возвращает null, если период неизвестен", () => {
    expect(subscriptionPeriod(base)).toEqual({ start: null, end: null });
  });
});

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Минимальный клиент Stripe на fetch (без SDK): Checkout, Billing Portal, чтение подписки
 * и проверка подписи webhook. Версия API закреплена, чтобы формат ответов не менялся неожиданно.
 */
const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_VERSION = "2024-06-20";
const SIGNATURE_TOLERANCE_SECONDS = 300;

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "StripeError";
  }
}

export type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
};

export type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  current_period_start?: number;
  current_period_end?: number;
  metadata: Record<string, string>;
  items?: { data: { current_period_start?: number; current_period_end?: number; price?: { id: string } }[] };
};

/** Кодирует вложенный объект в формат application/x-www-form-urlencoded, принятый Stripe. */
export function encodeForm(data: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "object" && item !== null) out.push(...encodeForm(item as Record<string, unknown>, `${name}[${index}]`));
        else out.push(`${encodeURIComponent(`${name}[${index}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof value === "object") {
      out.push(...encodeForm(value as Record<string, unknown>, name));
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return out;
}

export function createStripeClient(secretKey: string, fetchImpl: typeof fetch = fetch) {
  async function call<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
    const response = await fetchImpl(`${STRIPE_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Stripe-Version": STRIPE_VERSION,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? encodeForm(body).join("&") : undefined,
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
    if (!response.ok || !payload) {
      throw new StripeError(payload?.error?.message ?? `Stripe HTTP ${response.status}`, response.status, payload?.error?.code);
    }
    return payload as T;
  }

  return {
    createCheckoutSession(params: {
      priceId: string;
      userId: string;
      planId: string;
      email: string;
      customerId?: string | null;
      successUrl: string;
      cancelUrl: string;
      locale?: string;
    }) {
      return call<{ id: string; url: string | null }>("POST", "/checkout/sessions", {
        mode: "subscription",
        line_items: [{ price: params.priceId, quantity: 1 }],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        client_reference_id: params.userId,
        ...(params.customerId ? { customer: params.customerId } : { customer_email: params.email }),
        allow_promotion_codes: true,
        locale: params.locale ?? "auto",
        metadata: { user_id: params.userId, plan_id: params.planId },
        subscription_data: { metadata: { user_id: params.userId, plan_id: params.planId } },
      });
    },
    createPortalSession(params: { customerId: string; returnUrl: string }) {
      return call<{ url: string }>("POST", "/billing_portal/sessions", {
        customer: params.customerId,
        return_url: params.returnUrl,
      });
    },
    retrieveSubscription(id: string) {
      return call<StripeSubscription>("GET", `/subscriptions/${encodeURIComponent(id)}`);
    },
  };
}

export type StripeClient = ReturnType<typeof createStripeClient>;

/**
 * Проверка подписи webhook (заголовок Stripe-Signature: t=<время>,v1=<hmac>).
 * Подпись считается по сырому телу запроса; сравнение — за постоянное время.
 * Возвращает событие либо бросает StripeError.
 */
export function verifyStripeWebhook(rawBody: string, signatureHeader: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): StripeEvent {
  if (!secret) throw new StripeError("Webhook secret is not configured", 500);
  if (!signatureHeader) throw new StripeError("Missing signature", 400);

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.trim().split("=");
    if (key === "t") timestamp = value ?? "";
    if (key === "v1" && value) signatures.push(value);
  }
  const time = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(time) || signatures.length === 0) throw new StripeError("Malformed signature", 400);
  if (Math.abs(nowSeconds - time) > SIGNATURE_TOLERANCE_SECONDS) throw new StripeError("Signature timestamp out of tolerance", 400);

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest();
  const valid = signatures.some((signature) => {
    if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
    return timingSafeEqual(Buffer.from(signature, "hex"), expected);
  });
  if (!valid) throw new StripeError("Invalid signature", 400);

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw new StripeError("Invalid payload", 400);
  }
  const candidate = event as Partial<StripeEvent>;
  if (!candidate || typeof candidate.id !== "string" || typeof candidate.type !== "string" || !candidate.data?.object) {
    throw new StripeError("Invalid event", 400);
  }
  return candidate as StripeEvent;
}

/** Подпись для тестов и локальной отладки webhook. */
export function signStripePayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

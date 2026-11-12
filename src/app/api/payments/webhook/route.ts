import { type NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { getStripe } from "@/lib/payments";
import { StripeError, verifyStripeWebhook } from "@/lib/payments/stripe";
import { handleStripeEvent } from "@/lib/payments/webhook";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook платёжного провайдера (Stripe). Единственное место, где активируется Premium.
 * Событие принимается только с корректной подписью, вычисленной по сырому телу запроса.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const db = getAdminClient();
  if (!stripe || !db) return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });

  const rawBody = await request.text();
  let event;
  try {
    event = verifyStripeWebhook(rawBody, request.headers.get("stripe-signature"), serverEnv.stripeWebhookSecret);
  } catch (error) {
    const status = error instanceof StripeError && error.status === 500 ? 500 : 400;
    return NextResponse.json({ error: "invalid_signature" }, { status });
  }

  try {
    const outcome = await handleStripeEvent(db, stripe, event);
    return NextResponse.json({ received: true, ...outcome });
  } catch (error) {
    console.error("[webhook:stripe]", event.type, error instanceof Error ? error.message : error);
    // 500 заставит Stripe повторить доставку.
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}

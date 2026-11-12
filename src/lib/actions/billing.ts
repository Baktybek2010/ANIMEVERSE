"use server";

import { z } from "zod";
import { hasLocale, localizePath } from "@/i18n/config";
import { arePaymentsEnabled, getStripe, priceIdForPlan } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestOrigin } from "@/lib/site-url";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "./guard";
import { type ActionResult, fail, ok } from "./result";

const planSchema = z.string().regex(/^[a-z0-9_]{2,40}$/);

/**
 * Создаёт сессию оплаты у провайдера и возвращает адрес для перехода.
 * Premium здесь НЕ включается: подписка активируется только webhook-ом после подтверждённой оплаты.
 */
export async function createCheckoutAction(planInput: unknown, localeInput: unknown): Promise<ActionResult<{ url: string }>> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const plan = planSchema.safeParse(planInput);
  const locale = typeof localeInput === "string" && hasLocale(localeInput) ? localeInput : "ru";
  if (!plan.success) return fail("validation");
  if (!(await rateLimit("billing.checkout", user.id, 10, 600))) return fail("rateLimited");

  const stripe = getStripe();
  const priceId = priceIdForPlan(plan.data);
  if (!arePaymentsEnabled() || !stripe || !priceId) return fail("paymentsNotConfigured");

  // Оплаченная действующая подписка уже есть — повторная покупка не нужна.
  if (user.subscription && user.subscription.provider === "stripe" && user.isPremium) return fail("alreadySubscribed");

  const supabase = await createClient();
  const { data: planRow } = await supabase.from("plans").select("id").eq("id", plan.data).eq("is_active", true).maybeSingle();
  if (!planRow) return fail("notFound");

  // Повторно используем клиента Stripe, если пользователь уже платил раньше.
  const admin = getAdminClient();
  let customerId: string | null = null;
  if (admin) {
    const { data: previous } = await admin
      .from("subscriptions")
      .select("provider_customer_id")
      .eq("user_id", user.id)
      .eq("provider", "stripe")
      .not("provider_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    customerId = previous?.provider_customer_id ?? null;
  }

  const origin = await getRequestOrigin();
  try {
    const session = await stripe.createCheckoutSession({
      priceId,
      userId: user.id,
      planId: plan.data,
      email: user.email,
      customerId,
      successUrl: `${origin}${localizePath(locale, "/premium/success")}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${localizePath(locale, "/premium")}?notice=checkoutCanceled`,
      locale: locale === "ru" ? "ru" : locale === "ja" ? "ja" : "en",
    });
    if (!session.url) return fail("generic");
    return ok({ url: session.url });
  } catch {
    return fail("generic");
  }
}

/** Ссылка на защищённый портал провайдера: смена карты, отмена подписки, чеки. */
export async function createPortalAction(localeInput: unknown): Promise<ActionResult<{ url: string }>> {
  const { user, denied } = await authorize();
  if (denied) return denied;
  const locale = typeof localeInput === "string" && hasLocale(localeInput) ? localeInput : "ru";
  if (!(await rateLimit("billing.portal", user.id, 10, 600))) return fail("rateLimited");

  const stripe = getStripe();
  if (!stripe) return fail("paymentsNotConfigured");

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("user_id", user.id)
    .eq("provider", "stripe")
    .not("provider_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!subscription?.provider_customer_id) return fail("notFound");

  const origin = await getRequestOrigin();
  try {
    const session = await stripe.createPortalSession({
      customerId: subscription.provider_customer_id,
      returnUrl: `${origin}${localizePath(locale, "/account/subscription")}`,
    });
    return ok({ url: session.url });
  } catch {
    return fail("generic");
  }
}

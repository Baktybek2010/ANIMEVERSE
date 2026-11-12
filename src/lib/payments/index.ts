import "server-only";

import { isStripeConfigured, serverEnv } from "@/lib/env.server";
import { createStripeClient, type StripeClient } from "./stripe";

let client: StripeClient | undefined;

/** Клиент платёжного провайдера или null, если ключи не заданы. */
export function getStripe(): StripeClient | null {
  if (!isStripeConfigured()) return null;
  client ??= createStripeClient(serverEnv.stripeSecretKey);
  return client;
}

/** Идентификатор цены провайдера для тарифа (из переменных окружения). */
export function priceIdForPlan(planId: string): string | null {
  const map: Record<string, string> = {
    premium_monthly: serverEnv.stripePriceMonthly,
    premium_yearly: serverEnv.stripePriceYearly,
  };
  return map[planId] || null;
}

export function arePaymentsEnabled(): boolean {
  return isStripeConfigured();
}

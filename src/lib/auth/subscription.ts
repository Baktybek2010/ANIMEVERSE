export type SubscriptionStatus = "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "expired";

export type SubscriptionLike = {
  status: SubscriptionStatus;
  provider: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
};

/** Запас на доставку webhook о продлении для автопродлеваемых подписок. */
export const RENEWAL_GRACE_MS = 12 * 60 * 60 * 1000;

/**
 * Действует ли подписка на момент `now`. Логика повторяет SQL-функцию
 * public.has_active_subscription — источником истины остаётся база данных.
 */
export function isSubscriptionActive(subscription: SubscriptionLike | null | undefined, now: Date = new Date()): boolean {
  if (!subscription) return false;
  if (subscription.status !== "active" && subscription.status !== "trialing") return false;
  const end = new Date(subscription.current_period_end).getTime();
  if (Number.isNaN(end)) return false;
  const grace = subscription.provider === "manual" || subscription.cancel_at_period_end ? 0 : RENEWAL_GRACE_MS;
  return end + grace > now.getTime();
}

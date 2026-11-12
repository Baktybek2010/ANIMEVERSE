import "server-only";

/** Серверные секреты. Никогда не импортируйте этот модуль в клиентские компоненты. */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  },
  get stripeSecretKey() {
    return process.env.STRIPE_SECRET_KEY ?? "";
  },
  get stripeWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET ?? "";
  },
  get stripePriceMonthly() {
    return process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? "";
  },
  get stripePriceYearly() {
    return process.env.STRIPE_PRICE_PREMIUM_YEARLY ?? "";
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
};

export const isServiceRoleConfigured = () => Boolean(serverEnv.supabaseServiceRoleKey);
export const isStripeConfigured = () =>
  Boolean(serverEnv.stripeSecretKey && serverEnv.stripeWebhookSecret && (serverEnv.stripePriceMonthly || serverEnv.stripePriceYearly));

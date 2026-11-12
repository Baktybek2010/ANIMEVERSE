import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

let client: ReturnType<typeof createSupabaseClient<Database>> | undefined;

/**
 * Клиент с service_role-ключом: обходит RLS. Использовать только на сервере и только там,
 * где действие уже авторизовано (webhook с проверенной подписью, cron с секретом,
 * операции Auth Admin после проверки роли).
 * Возвращает null, если ключ не задан.
 */
export function getAdminClient() {
  const key = serverEnv.supabaseServiceRoleKey;
  if (!key || !publicEnv.supabaseUrl) return null;
  if (!client) {
    client = createSupabaseClient<Database>(publicEnv.supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

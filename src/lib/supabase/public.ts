import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

let client: ReturnType<typeof createSupabaseClient<Database>> | undefined;

/**
 * Анонимный клиент без cookies — для публичных данных каталога.
 * Его можно вызывать внутри `use cache`: результат не зависит от пользователя.
 */
export function getPublicClient() {
  if (!client) {
    client = createSupabaseClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

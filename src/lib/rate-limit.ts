import "server-only";

import { headers } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";

type Bucket = { windowStart: number; hits: number };

// Запасной ограничитель в памяти процесса (если service_role-ключ не задан).
const memory = new Map<string, Bucket>();

export function memoryRateLimit(key: string, limit: number, windowSeconds: number, now = Date.now()): boolean {
  const bucket = memory.get(key);
  if (!bucket || now - bucket.windowStart >= windowSeconds * 1000) {
    memory.set(key, { windowStart: now, hits: 1 });
    if (memory.size > 5000) {
      for (const [storedKey, stored] of memory) {
        if (now - stored.windowStart > 3600_000) memory.delete(storedKey);
      }
    }
    return true;
  }
  bucket.hits += 1;
  return bucket.hits <= limit;
}

/** IP клиента по заголовкам прокси. */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headerList.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Ограничение частоты: true — запрос разрешён.
 * Счётчики хранятся в Postgres (общие для всех экземпляров приложения);
 * без service_role-ключа используется счётчик в памяти.
 */
export async function rateLimit(action: string, identity: string, limit: number, windowSeconds: number): Promise<boolean> {
  const key = `${action}:${identity}`.slice(0, 200);
  const admin = getAdminClient();
  if (!admin) return memoryRateLimit(key, limit, windowSeconds);
  const { data, error } = await admin.rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) return memoryRateLimit(key, limit, windowSeconds);
  return data === true;
}

export async function rateLimitByIp(action: string, limit: number, windowSeconds: number): Promise<boolean> {
  return rateLimit(action, await getClientIp(), limit, windowSeconds);
}

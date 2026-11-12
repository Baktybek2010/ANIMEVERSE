import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";

/**
 * Авторизация служебных вызовов по расписанию: заголовок `Authorization: Bearer <CRON_SECRET>`
 * (Vercel Cron добавляет его автоматически). Без заданного секрета доступ закрыт.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = serverEnv.cronSecret;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

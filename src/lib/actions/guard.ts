import "server-only";

import { type Permission, can } from "@/lib/auth/roles";
import { type CurrentUser, getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { type ErrorKey, fail } from "./result";

type Denied = ReturnType<typeof fail>;

/**
 * Проверка авторизации внутри Server Action. Каждое действие авторизует себя само:
 * данным из браузера и состоянию интерфейса доверия нет.
 */
export async function authorize(permission?: Permission): Promise<{ user: CurrentUser; denied?: undefined } | { user?: undefined; denied: Denied }> {
  if (!isSupabaseConfigured) return { denied: fail("notConfigured") };
  const user = await getCurrentUser();
  if (!user) return { denied: fail("unauthorized") };
  if (user.isBanned) return { denied: fail("banned") };
  if (permission && !can(user.role, permission)) return { denied: fail("forbidden") };
  return { user };
}

export type { ErrorKey };

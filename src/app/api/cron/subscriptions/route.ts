import { type NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { getAdminClient } from "@/lib/supabase/admin";

/** Автоматическое истечение подписок, срок действия которых прошёл. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getAdminClient();
  if (!db) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data, error } = await db.rpc("expire_subscriptions");
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  return NextResponse.json({ expired: data ?? 0 });
}

import { NextResponse } from "next/server";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getPublicClient } from "@/lib/supabase/public";

/** Проверка состояния для мониторинга и балансировщика. */
export async function GET() {
  await connection();
  if (!isSupabaseConfigured) return NextResponse.json({ status: "degraded", database: "not_configured" }, { status: 503 });
  const { error } = await getPublicClient().from("roles").select("name", { head: true, count: "exact" });
  return NextResponse.json(
    { status: error ? "degraded" : "ok", database: error ? "unreachable" : "ok" },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}

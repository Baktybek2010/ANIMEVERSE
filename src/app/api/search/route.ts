import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { searchSuggestions } from "@/lib/data/catalog";
import { rateLimitByIp } from "@/lib/rate-limit";
import { normalizeQuery } from "@/lib/utils";

/** Подсказки для строки поиска. Публичный эндпоинт с ограничением частоты. */
export async function GET(request: NextRequest) {
  const q = normalizeQuery(request.nextUrl.searchParams.get("q"));
  const lang = request.nextUrl.searchParams.get("lang");
  const locale = hasLocale(lang) ? lang : defaultLocale;

  if (q.length < 2) return NextResponse.json({ items: [] });
  if (!(await rateLimitByIp("api.search", 90, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    const items = await searchSuggestions(q, locale);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

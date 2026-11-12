import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit, rateLimitByIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isEpisodeCompleted, progressSchema } from "@/lib/validation/profile";

/**
 * Сохранение прогресса просмотра и учёт просмотров.
 * Принимает JSON; вызывается плеером периодически и через sendBeacon при закрытии страницы.
 * Право на просмотр (в том числе Premium) проверяют RLS-политики и функция record_view.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  // Защита от CSRF: запросы с чужих сайтов отклоняются.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const { episodeId, position, duration } = parsed.data;
  const countView = typeof body === "object" && body !== null && (body as { view?: unknown }).view === true;

  const user = await getCurrentUser();
  if (user?.isBanned) return NextResponse.json({ error: "banned" }, { status: 403 });

  const allowed = user
    ? await rateLimit("api.progress", user.id, 120, 60)
    : await rateLimitByIp("api.progress.anon", 30, 60);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });

  const supabase = await createClient();

  if (countView) {
    await supabase.rpc("record_view", { p_episode: episodeId });
  }

  if (!user) return NextResponse.json({ saved: false });

  const { error } = await supabase.from("watch_history").upsert(
    {
      user_id: user.id,
      episode_id: episodeId,
      // anime_id проставляет триггер watch_history_before_write по эпизоду.
      anime_id: "00000000-0000-0000-0000-000000000000",
      position_seconds: Math.floor(position),
      duration_seconds: Math.floor(duration),
      completed: isEpisodeCompleted(position, duration),
    },
    { onConflict: "user_id,episode_id" },
  );
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" || error.code === "23503" ? 404 : 500;
    return NextResponse.json({ error: "save_failed" }, { status });
  }
  return NextResponse.json({ saved: true });
}

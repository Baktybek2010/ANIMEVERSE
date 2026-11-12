import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../helpers/supabase";
import { stopMediaServer } from "./media-server";

export default async function globalTeardown() {
  await stopMediaServer();
  loadEnv();
  const file = resolve(__dirname, ".auth/state.json");
  if (!existsSync(file)) return;
  const state = JSON.parse(readFileSync(file, "utf8")) as { runId: string; users: Record<string, { id: string }>; anime: { id: string } };
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  await db.from("anime").delete().eq("id", state.anime.id);
  await db.from("anime").delete().like("slug", `e2e-%${state.runId}%`);
  await db.from("genres").delete().like("slug", `e2e-%`);
  await db.from("announcements").delete().like("slug", `e2e-%`);
  for (const user of Object.values(state.users)) await db.auth.admin.deleteUser(user.id);
  // Пользователи, зарегистрированные через форму в ходе тестов.
  const { data } = await db.from("profiles").select("id").like("username", `e2e_%_${state.runId}`);
  for (const profile of data ?? []) await db.auth.admin.deleteUser(profile.id);
  rmSync(file, { force: true });
}

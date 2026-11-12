/**
 * Назначение роли пользователю по e-mail (первый супер-администратор и аварийные случаи).
 *
 *   npm run admin:promote -- user@example.com              — роль super_admin
 *   npm run admin:promote -- user@example.com moderator    — другая роль
 *
 * Использует service_role-ключ из .env.local, поэтому запускается только владельцем проекта.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

const ROLES = ["user", "moderator", "admin", "super_admin"];

async function main() {
  const [email, role = "super_admin"] = process.argv.slice(2);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Укажите NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local");
  if (!email || !ROLES.includes(role)) throw new Error(`Использование: npm run admin:promote -- <email> [${ROLES.join("|")}]`);

  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("profiles").update({ role }).eq("email", email.toLowerCase()).select("id, username, role");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error(`Пользователь ${email} не найден. Сначала зарегистрируйтесь на сайте.`);
  await db.from("admin_logs").insert({ action: "user.role_change", entity_type: "user", entity_id: data[0].id, details: { to: role, via: "cli" } });
  console.log(`Готово: @${data[0].username} теперь ${data[0].role}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

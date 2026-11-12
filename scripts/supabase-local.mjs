#!/usr/bin/env node
/**
 * Управление локальным Supabase-стеком (Docker Compose) без Supabase CLI.
 *
 *   node scripts/supabase-local.mjs up        — сгенерировать ключи, поднять стек, применить миграции
 *   node scripts/supabase-local.mjs migrate   — применить новые миграции из supabase/migrations
 *   node scripts/supabase-local.mjs env       — вывести переменные для .env.local
 *   node scripts/supabase-local.mjs types     — сгенерировать src/lib/supabase/database.types.ts
 *   node scripts/supabase-local.mjs reset     — удалить данные и поднять стек заново
 *   node scripts/supabase-local.mjs down      — остановить стек
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stackDir = join(root, "infra", "supabase-local");
const envFile = join(stackDir, ".env");
const migrationsDir = join(root, "supabase", "migrations");

const b64url = (input) => Buffer.from(input).toString("base64url");

function signJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function ensureEnv() {
  if (existsSync(envFile)) return parseEnv(readFileSync(envFile, "utf8"));
  const jwtSecret = randomBytes(32).toString("hex");
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 365 * 10;
  const env = {
    POSTGRES_PASSWORD: randomBytes(16).toString("hex"),
    JWT_SECRET: jwtSecret,
    ANON_KEY: signJwt({ role: "anon", iss: "supabase-local", iat: now, exp }, jwtSecret),
    SERVICE_ROLE_KEY: signJwt({ role: "service_role", iss: "supabase-local", iat: now, exp }, jwtSecret),
    API_PORT: process.env.SUPABASE_API_PORT ?? "54321",
    DB_PORT: process.env.SUPABASE_DB_PORT ?? "54322",
    META_PORT: "54323",
    MAIL_PORT: "54324",
    SITE_URL: process.env.SITE_URL ?? "http://localhost:3000",
    MAILER_AUTOCONFIRM: process.env.MAILER_AUTOCONFIRM ?? "false",
  };
  env.API_EXTERNAL_URL = `http://127.0.0.1:${env.API_PORT}`;
  writeFileSync(
    envFile,
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  console.log(`Создан ${envFile} с локальными ключами.`);
  return env;
}

function compose(args, options = {}) {
  const result = spawnSync("docker", ["compose", "--env-file", envFile, ...args], {
    cwd: stackDir,
    stdio: options.capture ? ["pipe", "pipe", "inherit"] : "inherit",
    input: options.input,
    encoding: "utf8",
  });
  if (result.status !== 0 && !options.allowFail) {
    throw new Error(`docker compose ${args.join(" ")} завершился с кодом ${result.status}`);
  }
  return result.stdout ?? "";
}

function psql(sql, { user = "postgres", allowFail = false, quiet = false } = {}) {
  const args = ["exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", "postgres", "-h", "localhost"];
  if (quiet) args.push("-q", "-t", "-A");
  return compose(args, { input: sql, capture: true, allowFail });
}

async function waitFor(label, check, attempts = 90) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      if (await check()) return;
    } catch {
      /* ещё не готово */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Сервис «${label}» не запустился вовремя`);
}

async function waitForStack(env) {
  const base = `http://127.0.0.1:${env.API_PORT}`;
  await waitFor("auth", async () => (await fetch(`${base}/auth/v1/health`)).ok);
  await waitFor("rest", async () => (await fetch(`${base}/rest/v1/`, { headers: { apikey: env.ANON_KEY } })).status < 500);
  await waitFor("storage", async () => (await fetch(`${base}/storage/v1/status`)).ok);
  // Схемы auth и storage создаются сервисами при первом запуске — ждём их таблицы.
  await waitFor("auth schema", () => psql("select 1 from auth.users limit 1;", { allowFail: false, quiet: true }) !== null);
  await waitFor("storage schema", () => psql("select 1 from storage.buckets limit 1;", { quiet: true }) !== null);
}

function migrate() {
  psql(
    `create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations (
       version text primary key, name text, applied_at timestamptz not null default now()
     );`,
    { quiet: true },
  );
  const applied = new Set(
    psql("select version from supabase_migrations.schema_migrations;", { quiet: true })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  let count = 0;
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (applied.has(version)) continue;
    console.log(`→ применяю миграцию ${file}`);
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    psql(
      `begin;\n${sql}\ninsert into supabase_migrations.schema_migrations(version, name) values ('${version}', '${rest.join("_")}');\ncommit;`,
      { quiet: true },
    );
    count += 1;
  }
  // PostgREST должен перечитать схему после DDL.
  psql("notify pgrst, 'reload schema';", { quiet: true });
  console.log(count ? `Применено миграций: ${count}` : "Новых миграций нет.");
}

function printEnv(env) {
  console.log(
    [
      "",
      "# Скопируйте в .env.local:",
      `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${env.API_PORT}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${env.ANON_KEY}`,
      `SUPABASE_SERVICE_ROLE_KEY=${env.SERVICE_ROLE_KEY}`,
      `# Postgres: postgresql://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:${env.DB_PORT}/postgres`,
      `# Почта (Mailpit): http://127.0.0.1:${env.MAIL_PORT}`,
      "",
    ].join("\n"),
  );
}

async function generateTypes(env) {
  const response = await fetch(
    `http://127.0.0.1:${env.META_PORT}/generators/typescript?included_schemas=public&detect_one_to_one_relationships=true`,
  );
  if (!response.ok) throw new Error(`postgres-meta вернул ${response.status}: ${await response.text()}`);
  const target = join(root, "src", "lib", "supabase", "database.types.ts");
  writeFileSync(target, await response.text());
  console.log(`Типы записаны в ${target}`);
}

const command = process.argv[2] ?? "up";
const env = ensureEnv();

switch (command) {
  case "init":
    break;
  case "up":
    compose(["up", "-d", "--wait", "db"]);
    compose(["up", "-d"]);
    await waitForStack(env);
    migrate();
    printEnv(env);
    break;
  case "migrate":
    migrate();
    break;
  case "env":
    printEnv(env);
    break;
  case "types":
    await generateTypes(env);
    break;
  case "psql":
    execFileSync(
      "docker",
      ["compose", "--env-file", envFile, "exec", "db", "psql", "-U", "postgres", "-d", "postgres", "-h", "localhost"],
      { cwd: stackDir, stdio: "inherit" },
    );
    break;
  case "reset":
    compose(["down", "-v"]);
    compose(["up", "-d", "--wait", "db"]);
    compose(["up", "-d"]);
    await waitForStack(env);
    migrate();
    printEnv(env);
    break;
  case "down":
    compose(["down"]);
    break;
  default:
    console.error(`Неизвестная команда: ${command}`);
    process.exit(1);
}

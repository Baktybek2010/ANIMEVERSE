import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

export const STATE_FILE = resolve(__dirname, ".auth/state.json");
export const MAIL_URL = process.env.E2E_MAIL_URL ?? "http://127.0.0.1:54324";

export type E2EState = {
  runId: string;
  password: string;
  users: Record<"user" | "viewer" | "admin", { id: string; email: string; username: string }>;
  anime: { id: string; slug: string; title: string; hasVideo: boolean };
  mediaPort: number;
};

export function readState(): E2EState {
  if (!existsSync(STATE_FILE)) throw new Error("Нет состояния e2e: глобальная подготовка не выполнилась");
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as E2EState;
}

/** Вход через форму сайта. */
export async function login(page: Page, email: string, password: string, next?: string) {
  await page.goto(`/ru/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Электронная почта").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("button", { name: "Меню пользователя" })).toBeVisible();
}

type MailMessage = { ID: string; To: { Address: string }[]; Subject: string; Created: string };

/** Ждёт письмо для адресата в Mailpit и возвращает первую ссылку из него. */
export async function waitForEmailLink(to: string, after: number): Promise<string> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const list = (await (await fetch(`${MAIL_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: MailMessage[] };
    const message = list.messages.find((item) => new Date(item.Created).getTime() >= after - 2000);
    if (message) {
      const full = (await (await fetch(`${MAIL_URL}/api/v1/message/${message.ID}`)).json()) as { HTML: string; Text: string };
      const match = /href="([^"]+)"/.exec(full.HTML) ?? /(https?:\/\/\S+)/.exec(full.Text);
      if (match) return match[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Письмо для ${to} не пришло`);
}

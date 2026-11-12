import "server-only";

import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";

/** Адрес сайта для ссылок в письмах и редиректов: NEXT_PUBLIC_SITE_URL либо origin текущего запроса. */
export async function getRequestOrigin(): Promise<string> {
  const explicit = publicEnv.siteUrl.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

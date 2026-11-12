import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { getSiteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/account", "/admin", "/login", "/register", "/forgot-password", "/reset-password", "/banned", "/premium/success", "/offline"];
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", ...locales.flatMap((locale) => privatePaths.map((path) => `/${locale}${path}`))],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
    host: getSiteUrl(),
  };
}

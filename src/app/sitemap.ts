import type { MetadataRoute } from "next";
import { defaultLocale, locales, localeTags } from "@/i18n/config";
import { getSitemapEntries } from "@/lib/data/catalog";
import { getSiteUrl } from "@/lib/env";

function entry(base: string, path: string, options: { lastModified?: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {};
  for (const locale of locales) languages[localeTags[locale]] = `${base}/${locale}${path}`;
  languages["x-default"] = `${base}/${defaultLocale}${path}`;
  return {
    url: `${base}/${defaultLocale}${path}`,
    lastModified: options.lastModified,
    changeFrequency: options.changeFrequency,
    priority: options.priority,
    alternates: { languages },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const { anime, news } = await getSitemapEntries();
  return [
    entry(base, "", { priority: 1, changeFrequency: "daily" }),
    entry(base, "/catalog", { priority: 0.9, changeFrequency: "daily" }),
    entry(base, "/news", { priority: 0.6, changeFrequency: "weekly" }),
    entry(base, "/premium", { priority: 0.5, changeFrequency: "monthly" }),
    ...anime.map((item) => entry(base, `/anime/${item.slug}`, { lastModified: item.updatedAt, priority: 0.8, changeFrequency: "weekly" })),
    ...news.map((item) => entry(base, `/news/${item.slug}`, { lastModified: item.updatedAt, priority: 0.5, changeFrequency: "monthly" })),
  ];
}

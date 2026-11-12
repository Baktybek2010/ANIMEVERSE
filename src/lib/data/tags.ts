/** Теги кеша Next.js. После изменения данных соответствующий тег сбрасывается. */
export const CACHE_TAGS = {
  anime: "anime",
  animeBySlug: (slug: string) => `anime:${slug}`,
  episodes: "episodes",
  genres: "genres",
  banners: "banners",
  news: "news",
  settings: "settings",
  plans: "plans",
} as const;

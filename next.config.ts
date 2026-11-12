import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

const remotePatterns: RemotePattern[] = [
  // Постеры и баннеры AniList
  { protocol: "https", hostname: "s4.anilist.co", pathname: "/file/anilistcdn/**" },
  // Превью официальных трейлеров YouTube
  { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
];

// Публичные файлы Supabase Storage (аватары, постеры, баннеры)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  try {
    const url = new URL(supabaseUrl);
    remotePatterns.push({
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: "/storage/v1/object/public/**",
    });
  } catch {
    // Некорректный URL — сообщит src/lib/env.ts при первом обращении.
  }
}

// Дополнительные хосты изображений через запятую: IMAGE_REMOTE_HOSTS=cdn.example.com,img.example.org
for (const host of (process.env.IMAGE_REMOTE_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean)) {
  remotePatterns.push({ protocol: "https", hostname: host });
}

const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // IMAGE_UNOPTIMIZED=true отключает оптимизатор Next.js (например, если изображения отдаёт внешний CDN
    // или серверу недоступны исходящие DNS-запросы).
    unoptimized: process.env.IMAGE_UNOPTIMIZED === "true",
    remotePatterns,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    // Локальный Supabase (127.0.0.1) допустим только в разработке и тестах.
    dangerouslyAllowLocalIP: process.env.ALLOW_LOCAL_IMAGE_HOSTS === "true",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

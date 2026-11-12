/* ANIMEVERSE service worker: офлайн-страница и кеш статических ресурсов.
   Страницы и API всегда запрашиваются из сети — персональные данные не кешируются. */
const VERSION = "av-v1";
const LOCALES = ["ru", "en", "ja"];
const OFFLINE_URLS = LOCALES.map((locale) => `/${locale}/offline`);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Навигация: сеть, при её отсутствии — офлайн-страница на языке пользователя.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const locale = LOCALES.find((item) => url.pathname.startsWith(`/${item}`)) ?? "ru";
        const cached = await caches.match(`/${locale}/offline`);
        return cached ?? new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }),
    );
    return;
  }

  // Неизменяемая статика сборки: сначала кеш.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

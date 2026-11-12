"use client";

import { useEffect } from "react";

/** Регистрирует service worker (офлайн-страница, установка как PWA) только в production. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Регистрация необязательна: сайт полностью работает и без неё.
    });
  }, []);
  return null;
}

import { PAGE_QUERY } from "./queries";
import type { AniListMedia, AniListPage, AniListSort } from "./types";

export const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export class AniListError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AniListError";
  }
}

export type AniListClientOptions = {
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  now?: () => number;
  maxRetries?: number;
  /** Время жизни кеша ответов в миллисекундах (0 — без кеша). */
  cacheTtlMs?: number;
  endpoint?: string;
};

type CacheEntry = { expiresAt: number; value: unknown };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Клиент AniList GraphQL:
 *  - соблюдает лимит запросов по заголовкам X-RateLimit-* и Retry-After;
 *  - повторяет запросы при 429/5xx/сетевых сбоях с экспоненциальной задержкой;
 *  - кеширует одинаковые запросы в памяти, чтобы не обращаться к API повторно;
 *  - объединяет одновременные одинаковые запросы в один.
 */
export function createAniListClient(options: AniListClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleepImpl ?? defaultSleep;
  const now = options.now ?? Date.now;
  const maxRetries = options.maxRetries ?? 4;
  const cacheTtlMs = options.cacheTtlMs ?? 10 * 60 * 1000;
  const endpoint = options.endpoint ?? ANILIST_ENDPOINT;

  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<unknown>>();
  let blockedUntil = 0;
  let queue: Promise<unknown> = Promise.resolve();

  async function send<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    let attempt = 0;
    for (;;) {
      const wait = blockedUntil - now();
      if (wait > 0) await sleep(wait);

      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query, variables }),
          cache: "no-store",
        });
      } catch (error) {
        if (attempt >= maxRetries) {
          throw new AniListError(`Сеть недоступна: ${(error as Error).message}`, 0);
        }
        await sleep(backoff(attempt));
        attempt += 1;
        continue;
      }

      // Запоминаем состояние лимита: если запросов не осталось — ждём сброса окна.
      const remaining = Number.parseInt(response.headers.get("x-ratelimit-remaining") ?? "", 10);
      const reset = Number.parseInt(response.headers.get("x-ratelimit-reset") ?? "", 10);
      if (Number.isFinite(remaining) && remaining <= 0) {
        blockedUntil = Number.isFinite(reset) && reset * 1000 > now() ? reset * 1000 : now() + 60_000;
      }

      if (response.status === 429) {
        const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
        const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 120) : 60;
        blockedUntil = Math.max(blockedUntil, now() + seconds * 1000);
        if (attempt >= maxRetries) throw new AniListError("Превышен лимит запросов AniList", 429, seconds);
        attempt += 1;
        continue;
      }

      if (response.status >= 500) {
        if (attempt >= maxRetries) throw new AniListError(`AniList недоступен (${response.status})`, response.status);
        await sleep(backoff(attempt));
        attempt += 1;
        continue;
      }

      const payload = (await response.json().catch(() => null)) as
        | { data?: T; errors?: { message: string; status?: number }[] }
        | null;
      if (!response.ok || !payload || payload.errors?.length || !payload.data) {
        const message = payload?.errors?.map((item) => item.message).join("; ") || `HTTP ${response.status}`;
        throw new AniListError(`Ошибка AniList: ${message}`, response.status);
      }
      return payload.data;
    }
  }

  function backoff(attempt: number): number {
    return Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
  }

  /** Запросы выполняются последовательно — так лимит не расходуется параллельными вызовами. */
  function request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const key = JSON.stringify([query, variables]);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return Promise.resolve(cached.value as T);
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;

    const run = queue.then(() => send<T>(query, variables));
    queue = run.catch(() => undefined);
    const tracked = run
      .then((value) => {
        if (cacheTtlMs > 0) {
          cache.set(key, { expiresAt: now() + cacheTtlMs, value });
          if (cache.size > 300) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
          }
        }
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, tracked);
    return tracked;
  }

  async function page(variables: {
    page?: number;
    perPage?: number;
    search?: string;
    ids?: number[];
    sort?: AniListSort[];
    season?: "WINTER" | "SPRING" | "SUMMER" | "FALL";
    seasonYear?: number;
    status?: "RELEASING" | "FINISHED" | "NOT_YET_RELEASED";
    includeAdult?: boolean;
  }): Promise<AniListPage> {
    const { includeAdult, ...rest } = variables;
    const data = await request<{ Page: AniListPage }>(PAGE_QUERY, {
      page: 1,
      perPage: 20,
      ...rest,
      // isAdult: false скрывает контент 18+; undefined — без фильтра.
      isAdult: includeAdult ? undefined : false,
    });
    return data.Page;
  }

  return {
    request,
    page,
    /** Поиск по названию. */
    search(query: string, pageNumber = 1, perPage = 20) {
      return page({ search: query, page: pageNumber, perPage, sort: ["SEARCH_MATCH"] });
    },
    /** Тайтлы по списку идентификаторов AniList (до 50 за запрос). */
    async byIds(ids: number[]): Promise<AniListMedia[]> {
      const out: AniListMedia[] = [];
      for (let index = 0; index < ids.length; index += 50) {
        const chunk = ids.slice(index, index + 50);
        const result = await page({ ids: chunk, perPage: 50, includeAdult: true });
        out.push(...result.media);
      }
      return out;
    },
    clearCache() {
      cache.clear();
    },
  };
}

export type AniListClient = ReturnType<typeof createAniListClient>;

let shared: AniListClient | undefined;

/** Общий экземпляр клиента на процесс (общий кеш и учёт лимитов). */
export function getAniListClient(): AniListClient {
  shared ??= createAniListClient();
  return shared;
}

export function currentAniListSeason(date = new Date()): { season: "WINTER" | "SPRING" | "SUMMER" | "FALL"; year: number } {
  const month = date.getUTCMonth();
  const season = month <= 2 ? "WINTER" : month <= 5 ? "SPRING" : month <= 8 ? "SUMMER" : "FALL";
  return { season, year: date.getUTCFullYear() };
}

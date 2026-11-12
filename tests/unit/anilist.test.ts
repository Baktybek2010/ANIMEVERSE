import { describe, expect, it, vi } from "vitest";
import { AniListError, createAniListClient, currentAniListSeason } from "@/lib/anilist/client";
import { buildSyncPatch, fuzzyDateToIso, mapMedia } from "@/lib/anilist/mapper";
import type { AniListMedia } from "@/lib/anilist/types";

const media: AniListMedia = {
  id: 21,
  idMal: 21,
  title: { romaji: "ONE PIECE", english: "ONE PIECE", native: "ONE PIECE" },
  synonyms: ["OP", " ", "x".repeat(300)],
  description: "Gold Roger was known as the <i>Pirate King</i>.<br><br>Second paragraph &amp; more.",
  format: "TV",
  status: "RELEASING",
  season: "FALL",
  seasonYear: 1999,
  startDate: { year: 1999, month: 10, day: 20 },
  endDate: { year: null, month: null, day: null },
  episodes: null,
  duration: 24,
  averageScore: 87,
  meanScore: 88,
  popularity: 600000,
  trending: 300,
  genres: ["Action", "Sci-Fi", "Slice of Life", "Hentai"],
  isAdult: false,
  countryOfOrigin: "JP",
  source: "MANGA",
  coverImage: { extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21.jpg", large: null, color: "#e4a15d" },
  bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21.jpg",
  trailer: { id: "MCb13lbVGE0", site: "youtube" },
  studios: { nodes: [{ name: "Toei Animation" }] },
};

function page(items: AniListMedia[]) {
  return { data: { Page: { pageInfo: { total: items.length, currentPage: 1, lastPage: 1, hasNextPage: false, perPage: 20 }, media: items } } };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

describe("преобразование данных AniList", () => {
  it("переводит запись в поля таблицы anime", () => {
    const { anime, genres, slugBase } = mapMedia(media);
    expect(anime).toMatchObject({
      anilist_id: 21,
      title_romaji: "ONE PIECE",
      format: "tv",
      status: "ongoing",
      season: "fall",
      season_year: 1999,
      start_date: "1999-10-20",
      end_date: null,
      episodes_total: null,
      episode_duration: 24,
      score: 8.7,
      trailer_youtube_id: "MCb13lbVGE0",
      studio: "Toei Animation",
      source: "manga",
      country: "JP",
      poster_color: "#e4a15d",
      is_adult: false,
    });
    expect(anime.synonyms).toEqual(["OP"]);
    expect(slugBase).toBe("one-piece");
    expect(genres.map((genre) => genre.slug)).toEqual(["action", "sci-fi", "slice-of-life"]);
  });

  it("очищает HTML в описании", () => {
    const { anime } = mapMedia(media);
    expect(anime.description).toBe("Gold Roger was known as the Pirate King.\n\nSecond paragraph & more.");
    expect(anime.description).not.toMatch(/[<>]/);
  });

  it("отбрасывает небезопасные и некорректные значения", () => {
    const { anime, slugBase } = mapMedia({
      ...media,
      id: 999,
      title: { romaji: null, english: null, native: "進撃の巨人" },
      coverImage: { extraLarge: "http://insecure.example/a.jpg", large: "javascript:alert(1)", color: "red" },
      bannerImage: "//evil.example/b.jpg",
      trailer: { id: "x'><script>", site: "youtube" },
      averageScore: null,
      meanScore: null,
      countryOfOrigin: "Japan",
      format: "UNKNOWN",
      status: null,
    });
    expect(anime.poster_url).toBeNull();
    expect(anime.banner_url).toBeNull();
    expect(anime.poster_color).toBeNull();
    expect(anime.trailer_youtube_id).toBeNull();
    expect(anime.score).toBeNull();
    expect(anime.country).toBeNull();
    expect(anime.format).toBe("tv");
    expect(anime.status).toBe("announced");
    expect(anime.title_romaji).toBe("進撃の巨人");
    expect(slugBase).toBe("anime-999");
  });

  it("разбирает неполные даты", () => {
    expect(fuzzyDateToIso({ year: 2024, month: null, day: null })).toBe("2024-01-01");
    expect(fuzzyDateToIso({ year: 2024, month: 7, day: null })).toBe("2024-07-01");
    expect(fuzzyDateToIso({ year: null, month: 7, day: 1 })).toBeNull();
    expect(fuzzyDateToIso(null)).toBeNull();
  });

  it("не перезаписывает поля, изменённые вручную", () => {
    const { anime } = mapMedia(media);
    const patch = buildSyncPatch(anime, ["description", "poster_url"]);
    expect(patch).not.toHaveProperty("description");
    expect(patch).not.toHaveProperty("poster_url");
    expect(patch.score).toBe(8.7);
    expect(patch).not.toHaveProperty("anilist_id");
  });

  it("перезаписывает всё при принудительной синхронизации", () => {
    const { anime } = mapMedia(media);
    const patch = buildSyncPatch(anime, ["description", "poster_url"], true);
    expect(patch.description).toBe(anime.description);
    expect(patch.poster_url).toBe(anime.poster_url);
  });
});

describe("клиент AniList", () => {
  const options = (fetchImpl: unknown, extra = {}) => ({
    fetchImpl: fetchImpl as typeof fetch,
    sleepImpl: vi.fn(async () => undefined),
    ...extra,
  });

  it("кеширует одинаковые запросы", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(page([media])));
    const client = createAniListClient(options(fetchMock));
    const first = await client.search("one piece");
    const second = await client.search("one piece");
    expect(first.media[0].id).toBe(21);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await client.search("naruto");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("объединяет одновременные одинаковые запросы", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(page([media])));
    const client = createAniListClient(options(fetchMock));
    await Promise.all([client.search("bleach"), client.search("bleach"), client.search("bleach")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ждёт Retry-After при ответе 429 и повторяет запрос", async () => {
    let now = 1_000_000;
    const sleepImpl = vi.fn(async (ms: number) => {
      now += ms;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ errors: [{ message: "Too Many Requests" }] }, 429, { "Retry-After": "30" }))
      .mockResolvedValueOnce(jsonResponse(page([media])));
    const client = createAniListClient({ fetchImpl: fetchMock as unknown as typeof fetch, sleepImpl, now: () => now });
    const result = await client.search("one piece");
    expect(result.media).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledWith(30_000);
  });

  it("приостанавливается, когда лимит запросов исчерпан", async () => {
    let now = 2_000_000_000;
    const sleepImpl = vi.fn(async (ms: number) => {
      now += ms;
    });
    const resetAt = Math.floor(now / 1000) + 20;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page([media]), 200, { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(resetAt) }))
      .mockResolvedValueOnce(jsonResponse(page([])));
    const client = createAniListClient({ fetchImpl: fetchMock as unknown as typeof fetch, sleepImpl, now: () => now });
    await client.search("a1");
    expect(sleepImpl).not.toHaveBeenCalled();
    await client.search("b2");
    expect(sleepImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl.mock.calls[0][0]).toBeGreaterThan(15_000);
  });

  it("повторяет запрос при ошибках сервера и сети", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 502))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse(page([media])));
    const client = createAniListClient(options(fetchMock));
    const result = await client.search("retry");
    expect(result.media[0].id).toBe(21);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("прекращает попытки после исчерпания лимита повторов", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 503));
    const client = createAniListClient(options(fetchMock, { maxRetries: 2 }));
    await expect(client.search("down")).rejects.toBeInstanceOf(AniListError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("не повторяет запрос при ошибке GraphQL", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ errors: [{ message: "Syntax Error", status: 400 }] }, 400));
    const client = createAniListClient(options(fetchMock));
    await expect(client.search("bad")).rejects.toThrow("Syntax Error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("не кеширует неудачные запросы", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ errors: [{ message: "Bad" }] }, 400))
      .mockResolvedValueOnce(jsonResponse(page([media])));
    const client = createAniListClient(options(fetchMock));
    await expect(client.search("flaky")).rejects.toBeInstanceOf(AniListError);
    expect((await client.search("flaky")).media).toHaveLength(1);
  });

  it("запрашивает тайтлы по id пачками по 50 и скрывает 18+ в поиске", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(page([])));
    const client = createAniListClient(options(fetchMock));
    await client.byIds(Array.from({ length: 120 }, (_, index) => index + 1));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await client.search("safe");
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const body = JSON.parse(calls[3][1].body as string) as { variables: { isAdult?: boolean; search: string } };
    expect(body.variables.isAdult).toBe(false);
    expect(body.variables.search).toBe("safe");
  });

  it("определяет текущий сезон", () => {
    expect(currentAniListSeason(new Date("2026-01-15T00:00:00Z"))).toEqual({ season: "WINTER", year: 2026 });
    expect(currentAniListSeason(new Date("2026-11-12T00:00:00Z"))).toEqual({ season: "FALL", year: 2026 });
  });
});

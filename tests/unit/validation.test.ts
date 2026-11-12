import { describe, expect, it } from "vitest";
import { zodFieldErrors } from "@/lib/actions/result";
import { slugify } from "@/lib/slug";
import { sniffImage, validateImageUpload, validateVttUpload } from "@/lib/upload";
import { escapeLike, normalizeQuery, safeRedirectPath } from "@/lib/utils";
import { animeSchema, bannerSchema, episodeSchema, sourceSchema } from "@/lib/validation/admin";
import { loginSchema, passwordSchema, registerSchema, usernameSchema } from "@/lib/validation/auth";
import { catalogFiltersToQuery, countActiveFilters, parseCatalogFilters } from "@/lib/validation/catalog";
import { isEpisodeCompleted, progressSchema } from "@/lib/validation/profile";

describe("регистрация и вход", () => {
  const valid = { username: "sakura_01", email: "User@Example.com", password: "passw0rd!", confirmPassword: "passw0rd!", locale: "ru" };

  it("принимает корректные данные и нормализует e-mail", () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("user@example.com");
  });

  it("отклоняет несовпадающие пароли", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "other123" });
    expect(result.success).toBe(false);
    if (!result.success) expect(zodFieldErrors(result.error)).toEqual({ confirmPassword: "passwordsMismatch" });
  });

  it.each(["ab", "имя", "with space", "a".repeat(25), "semi;colon"])("отклоняет имя пользователя %s", (username) => {
    expect(usernameSchema.safeParse(username).success).toBe(false);
  });

  it.each(["short1", "onlyletters", "12345678", "a".repeat(73) + "1"])("отклоняет слабый пароль %s", (password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });

  it("отклоняет некорректный e-mail с ключом словаря", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) expect(zodFieldErrors(result.error).email).toBe("invalidEmail");
  });

  it("не принимает неизвестную локаль", () => {
    expect(registerSchema.safeParse({ ...valid, locale: "de" }).success).toBe(false);
  });
});

describe("фильтры каталога", () => {
  it("разбирает корректные параметры", () => {
    const filters = parseCatalogFilters({ q: "  one   piece ", genre: "drama,action", year: "2020", season: "fall", format: "tv", status: "ongoing", sort: "score", page: "3" });
    expect(filters).toEqual({ q: "one piece", genres: ["action", "drama"], year: 2020, season: "fall", format: "tv", status: "ongoing", sort: "score", page: 3 });
    expect(countActiveFilters(filters)).toBe(6);
  });

  it("отбрасывает некорректные и вредоносные значения", () => {
    const filters = parseCatalogFilters({
      q: "x".repeat(500),
      genre: "action,DROP TABLE;--,<script>,../etc",
      year: "99999",
      season: "monsoon",
      format: "' OR 1=1",
      status: ["ongoing", "finished"],
      sort: "random()",
      page: "-5",
    });
    expect(filters.q).toHaveLength(80);
    expect(filters.genres).toEqual(["action"]);
    expect(filters.year).toBeNull();
    expect(filters.season).toBeNull();
    expect(filters.format).toBeNull();
    expect(filters.status).toBe("ongoing");
    expect(filters.sort).toBe("popularity");
    expect(filters.page).toBe(1);
  });

  it("ограничивает число жанров и убирает дубликаты", () => {
    const filters = parseCatalogFilters({ genre: "a,b,c,d,e,f,g,h,a,b" });
    expect(filters.genres).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("строит строку запроса без значений по умолчанию", () => {
    expect(catalogFiltersToQuery(parseCatalogFilters({}))).toEqual({});
    expect(catalogFiltersToQuery(parseCatalogFilters({ genre: "action", sort: "score" }))).toMatchObject({ genre: "action", sort: "score" });
  });
});

describe("прогресс просмотра", () => {
  it("проверяет входные данные", () => {
    expect(progressSchema.safeParse({ episodeId: "8c6f1f0e-6a55-4d5b-9d3a-0d1d6f8f0c11", position: 120.5, duration: 1440 }).success).toBe(true);
    expect(progressSchema.safeParse({ episodeId: "not-a-uuid", position: 1, duration: 2 }).success).toBe(false);
    expect(progressSchema.safeParse({ episodeId: "8c6f1f0e-6a55-4d5b-9d3a-0d1d6f8f0c11", position: -1, duration: 2 }).success).toBe(false);
    expect(progressSchema.safeParse({ episodeId: "8c6f1f0e-6a55-4d5b-9d3a-0d1d6f8f0c11", position: Number.POSITIVE_INFINITY, duration: 2 }).success).toBe(false);
  });

  it("определяет досмотренную серию", () => {
    expect(isEpisodeCompleted(1300, 1440)).toBe(false);
    expect(isEpisodeCompleted(1351, 1440)).toBe(true);
    expect(isEpisodeCompleted(93, 100)).toBe(true);
    expect(isEpisodeCompleted(50, 0)).toBe(false);
  });
});

describe("админ-формы", () => {
  const anime = {
    slug: "", title_romaji: "Test Anime", title_english: "", title_native: "", title_ru: "", description_ru: "", description_en: "", description_ja: "",
    synonyms: "One\n\nTwo", format: "tv", status: "ongoing", season: "", season_year: "2024", start_date: "2024-01-05", end_date: "",
    episodes_total: "12", episode_duration: "", score: "8.456", studio: "", source: "", trailer_youtube_id: "", poster_url: "", banner_url: "",
    genre_ids: ["1", 2], is_published: true, is_featured: false, is_adult: false,
  };

  it("нормализует значения формы аниме", () => {
    const result = animeSchema.safeParse(anime);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.synonyms).toEqual(["One", "Two"]);
    expect(result.data.season_year).toBe(2024);
    expect(result.data.episodes_total).toBe(12);
    expect(result.data.episode_duration).toBeNull();
    expect(result.data.score).toBe(8.46);
    expect(result.data.title_english).toBeNull();
    expect(result.data.genre_ids).toEqual([1, 2]);
  });

  it("отклоняет javascript:-ссылки и неверные даты", () => {
    expect(animeSchema.safeParse({ ...anime, poster_url: "javascript:alert(1)" }).success).toBe(false);
    expect(animeSchema.safeParse({ ...anime, start_date: "2024-05-01", end_date: "2024-01-01" }).success).toBe(false);
    expect(animeSchema.safeParse({ ...anime, score: "11" }).success).toBe(false);
    expect(animeSchema.safeParse({ ...anime, format: "podcast" }).success).toBe(false);
  });

  it("проверяет источники видео и эпизоды", () => {
    const source = { kind: "hls", url: "https://cdn.example.com/master.m3u8", quality: "auto", audio_lang: "ja", audio_label: "", is_default: true };
    expect(sourceSchema.safeParse(source).success).toBe(true);
    expect(sourceSchema.safeParse({ ...source, url: "ftp://example.com/video.mp4" }).success).toBe(false);
    expect(sourceSchema.safeParse({ ...source, quality: "ultra" }).success).toBe(false);
    expect(sourceSchema.safeParse({ ...source, audio_lang: "japanese!" }).success).toBe(false);
    expect(episodeSchema.safeParse({ number: "0", title_ru: "", title_en: "", title_ja: "", description: "", thumbnail_url: "", duration_seconds: "", air_date: "", is_premium: false, is_published: false }).success).toBe(true);
  });

  it("баннер требует аниме либо заголовок с изображением", () => {
    const base = { anime_slug: "", title_ru: "", title_en: "", title_ja: "", subtitle_ru: "", subtitle_en: "", subtitle_ja: "", image_url: "", link_url: "", sort_order: "0", is_active: true, starts_at: "", ends_at: "" };
    expect(bannerSchema.safeParse(base).success).toBe(false);
    expect(bannerSchema.safeParse({ ...base, anime_slug: "one-piece" }).success).toBe(true);
    expect(bannerSchema.safeParse({ ...base, title_ru: "Акция", image_url: "https://example.com/a.jpg" }).success).toBe(true);
    expect(bannerSchema.safeParse({ ...base, anime_slug: "one-piece", link_url: "//evil.example" }).success).toBe(false);
    expect(bannerSchema.safeParse({ ...base, anime_slug: "one-piece", link_url: "http://insecure.example" }).success).toBe(false);
  });
});

describe("утилиты", () => {
  it("строит ЧПУ из латиницы, кириллицы и спецсимволов", () => {
    expect(slugify("Shingeki no Kyojin: The Final Season")).toBe("shingeki-no-kyojin-the-final-season");
    expect(slugify("Атака титанов")).toBe("ataka-titanov");
    expect(slugify("Re:ZERO -Starting Life in Another World-")).toBe("re-zero-starting-life-in-another-world");
    expect(slugify("進撃の巨人")).toBe("");
    expect(slugify("Pokémon")).toBe("pokemon");
  });

  it("защищает от открытых редиректов", () => {
    expect(safeRedirectPath("/ru/account", "/ru")).toBe("/ru/account");
    expect(safeRedirectPath("//evil.example", "/ru")).toBe("/ru");
    expect(safeRedirectPath("https://evil.example", "/ru")).toBe("/ru");
    expect(safeRedirectPath("/\\evil.example", "/ru")).toBe("/ru");
    expect(safeRedirectPath(null, "/ru")).toBe("/ru");
  });

  it("экранирует шаблоны LIKE и нормализует запрос", () => {
    expect(escapeLike("100%_done\\")).toBe("100\\%\\_done\\\\");
    expect(normalizeQuery("  a   b  ")).toBe("a b");
  });
});

describe("проверка загружаемых файлов", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  it("определяет формат по сигнатуре", () => {
    expect(sniffImage(png)).toBe("png");
    expect(sniffImage(jpeg)).toBe("jpeg");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).toBeNull();
  });

  it("не доверяет расширению и заявленному типу", async () => {
    const fake = new File([new TextEncoder().encode("<?php echo 1; ?> padding padding")], "avatar.png", { type: "image/png" });
    expect(await validateImageUpload(fake, { maxBytes: 1000, allowed: ["png"] })).toEqual({ ok: false, error: "fileType" });
  });

  it("ограничивает размер и набор форматов", async () => {
    const file = new File([png], "a.png", { type: "image/png" });
    expect(await validateImageUpload(file, { maxBytes: 5, allowed: ["png"] })).toEqual({ ok: false, error: "fileTooLarge" });
    expect(await validateImageUpload(file, { maxBytes: 1000, allowed: ["jpeg"] })).toEqual({ ok: false, error: "fileType" });
    expect((await validateImageUpload(file, { maxBytes: 1000, allowed: ["png"] })).ok).toBe(true);
    expect(await validateImageUpload("not a file", { maxBytes: 1000, allowed: ["png"] })).toEqual({ ok: false, error: "required" });
  });

  it("принимает только WebVTT-субтитры", async () => {
    const good = new File(["WEBVTT\n\n00:00.000 --> 00:01.000\nHi"], "s.vtt");
    const bad = new File(["1\n00:00:00,000 --> 00:00:01,000\nHi"], "s.vtt");
    expect((await validateVttUpload(good, 1000)).ok).toBe(true);
    expect(await validateVttUpload(bad, 1000)).toEqual({ ok: false, error: "fileType" });
  });
});

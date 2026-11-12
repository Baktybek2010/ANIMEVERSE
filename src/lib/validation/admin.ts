import { z } from "zod";
import { ROLES } from "@/lib/auth/roles";
import { ANIME_FORMATS, ANIME_SEASONS, ANIME_STATUSES } from "@/lib/data/types";
import { SLUG_PATTERN } from "@/lib/slug";

// Сообщения — ключи словаря errors.*.
const text = (max: number) => z.string().trim().max(max, "tooLong");
const requiredText = (max: number) => text(max).min(1, "required");
const nullableText = (max: number) => text(max).transform((value) => (value === "" ? null : value));

const nullableInt = (min: number, max: number) =>
  z
    .union([z.literal(""), z.null(), z.coerce.number().int("invalidValue").min(min, "invalidValue").max(max, "invalidValue")])
    .transform((value) => (value === "" || value === null ? null : value));

const nullableUrl = z
  .string()
  .trim()
  .max(2000, "tooLong")
  .refine((value) => value === "" || /^https?:\/\/\S+$/.test(value), "invalidUrl")
  .transform((value) => (value === "" ? null : value));

const requiredUrl = z.string().trim().max(2000, "tooLong").regex(/^https?:\/\/\S+$/, "invalidUrl");

const nullableDate = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))), "invalidValue")
  .transform((value) => (value === "" ? null : value));

const nullableDateTime = z
  .string()
  .trim()
  .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), "invalidValue")
  .transform((value) => (value === "" ? null : new Date(value).toISOString()));

const optionalSlug = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, "tooLong")
  .refine((value) => value === "" || SLUG_PATTERN.test(value), "invalidValue");

const langCode = z.string().trim().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/, "invalidValue");

export const uuidSchema = z.uuid("invalidValue");

export const animeSchema = z
  .object({
    slug: optionalSlug,
    title_romaji: requiredText(300),
    title_english: nullableText(300),
    title_native: nullableText(300),
    title_ru: nullableText(300),
    description_ru: nullableText(20000),
    description_en: nullableText(20000),
    description_ja: nullableText(20000),
    synonyms: text(3000).transform((value) =>
      value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.length <= 200)
        .slice(0, 12),
    ),
    format: z.enum(ANIME_FORMATS as [string, ...string[]]),
    status: z.enum(ANIME_STATUSES as [string, ...string[]]),
    season: z.union([z.literal(""), z.enum(ANIME_SEASONS as [string, ...string[]])]).transform((value) => (value === "" ? null : value)),
    season_year: nullableInt(1900, 2100),
    start_date: nullableDate,
    end_date: nullableDate,
    episodes_total: nullableInt(0, 10000),
    episode_duration: nullableInt(0, 1000),
    score: z
      .union([z.literal(""), z.null(), z.coerce.number().min(0, "invalidValue").max(10, "invalidValue")])
      .transform((value) => (value === "" || value === null ? null : Math.round(value * 100) / 100)),
    studio: nullableText(120),
    source: nullableText(60),
    trailer_youtube_id: z
      .string()
      .trim()
      .refine((value) => value === "" || /^[A-Za-z0-9_-]{6,20}$/.test(value), "invalidValue")
      .transform((value) => (value === "" ? null : value)),
    poster_url: nullableUrl,
    banner_url: nullableUrl,
    genre_ids: z.array(z.coerce.number().int().positive()).max(30),
    is_published: z.boolean(),
    is_featured: z.boolean(),
    is_adult: z.boolean(),
  })
  .refine((value) => !value.start_date || !value.end_date || value.end_date >= value.start_date, {
    message: "invalidValue",
    path: ["end_date"],
  });

export const seasonSchema = z.object({
  number: z.coerce.number().int("invalidValue").min(0, "invalidValue").max(100, "invalidValue"),
  title_ru: nullableText(200),
  title_en: nullableText(200),
  title_ja: nullableText(200),
});

export const episodeSchema = z.object({
  number: z.coerce.number().int("invalidValue").min(0, "invalidValue").max(5000, "invalidValue"),
  title_ru: nullableText(300),
  title_en: nullableText(300),
  title_ja: nullableText(300),
  description: nullableText(5000),
  thumbnail_url: nullableUrl,
  duration_seconds: nullableInt(0, 86400),
  air_date: nullableDate,
  is_premium: z.boolean(),
  is_published: z.boolean(),
});

export const sourceSchema = z.object({
  kind: z.enum(["hls", "mp4", "webm"]),
  url: requiredUrl,
  quality: z.string().trim().regex(/^(auto|[0-9]{3,4}p)$/, "invalidValue"),
  audio_lang: langCode,
  audio_label: nullableText(80),
  is_default: z.boolean(),
});

export const subtitleSchema = z.object({
  lang: langCode,
  label: requiredText(80),
  url: nullableUrl,
  is_default: z.boolean(),
});

export const genreSchema = z.object({
  slug: z.string().trim().toLowerCase().min(1, "required").max(40, "tooLong").regex(SLUG_PATTERN, "invalidValue"),
  name_ru: requiredText(60),
  name_en: requiredText(60),
  name_ja: requiredText(60),
});

export const bannerSchema = z
  .object({
    anime_slug: optionalSlug,
    title_ru: nullableText(200),
    title_en: nullableText(200),
    title_ja: nullableText(200),
    subtitle_ru: nullableText(500),
    subtitle_en: nullableText(500),
    subtitle_ja: nullableText(500),
    image_url: nullableUrl,
    link_url: z
      .string()
      .trim()
      .max(500, "tooLong")
      .refine((value) => value === "" || /^(\/(?!\/)|https:\/\/)\S*$/.test(value), "invalidUrl")
      .transform((value) => (value === "" ? null : value)),
    sort_order: z.coerce.number().int("invalidValue").min(0).max(1000),
    is_active: z.boolean(),
    starts_at: nullableDateTime,
    ends_at: nullableDateTime,
  })
  .refine((value) => value.anime_slug !== "" || (value.image_url !== null && value.title_ru !== null), {
    message: "required",
    path: ["title_ru"],
  })
  .refine((value) => !value.starts_at || !value.ends_at || value.ends_at > value.starts_at, {
    message: "invalidValue",
    path: ["ends_at"],
  });

export const newsSchema = z.object({
  slug: optionalSlug,
  title_ru: requiredText(200),
  title_en: nullableText(200),
  title_ja: nullableText(200),
  body_ru: requiredText(20000),
  body_en: nullableText(20000),
  body_ja: nullableText(20000),
  cover_url: nullableUrl,
  is_published: z.boolean(),
});

export const settingsSchema = z.object({
  site_name: requiredText(60),
  contact_email: z
    .string()
    .trim()
    .max(254, "tooLong")
    .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "invalidEmail"),
  registration_enabled: z.boolean(),
  maintenance_mode: z.boolean(),
  anilist_auto_sync: z.boolean(),
  anilist_sync_batch: z.coerce.number().int("invalidValue").min(1, "invalidValue").max(50, "invalidValue"),
});

export const planSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{2,40}$/, "invalidValue"),
  name_ru: requiredText(80),
  name_en: requiredText(80),
  name_ja: requiredText(80),
  price_cents: z.coerce.number().int("invalidValue").min(0, "invalidValue").max(100000000, "invalidValue"),
  currency: z.string().trim().toLowerCase().regex(/^[a-z]{3}$/, "invalidValue"),
  is_active: z.boolean(),
});

export const roleSchema = z.enum(ROLES);
export const banSchema = z.object({ banned: z.boolean(), reason: text(500) });
export const grantSchema = z.object({
  plan: z.string().regex(/^[a-z0-9_]{2,40}$/, "invalidValue"),
  days: z.coerce.number().int("invalidValue").min(1, "invalidValue").max(3650, "invalidValue"),
});

export const importSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1, "required").max(50, "tooLong"),
  publish: z.boolean(),
});

export type AnimeInput = z.input<typeof animeSchema>;
export type SeasonInput = z.input<typeof seasonSchema>;
export type EpisodeInput = z.input<typeof episodeSchema>;
export type SourceInput = z.input<typeof sourceSchema>;
export type GenreInput = z.input<typeof genreSchema>;
export type BannerInput = z.input<typeof bannerSchema>;
export type NewsInput = z.input<typeof newsSchema>;
export type SettingsInput = z.input<typeof settingsSchema>;
export type PlanInput = z.input<typeof planSchema>;

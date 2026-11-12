import { z } from "zod";
import { locales } from "@/i18n/config";
import { usernameSchema } from "./auth";

const langCode = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/, "invalidValue");

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "required").max(50, "tooLong"),
  username: usernameSchema,
  bio: z.string().trim().max(500, "tooLong"),
});

export const preferencesSchema = z.object({
  autoplayNext: z.boolean(),
  audioLang: langCode.or(z.literal("")),
  subtitleLang: langCode.or(z.literal("")).or(z.literal("off")),
  quality: z.string().regex(/^(auto|[0-9]{3,4}p)$/, "invalidValue"),
  emailNotifications: z.boolean(),
  locale: z.enum(locales),
});

export const progressSchema = z.object({
  episodeId: z.uuid("invalidValue"),
  position: z.number().finite().min(0).max(86400),
  duration: z.number().finite().min(0).max(86400),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;

/** Серия считается досмотренной, если осталось меньше 90 секунд или просмотрено 92%. */
export function isEpisodeCompleted(position: number, duration: number): boolean {
  if (!duration || duration <= 0) return false;
  return position >= duration - 90 || position / duration >= 0.92;
}

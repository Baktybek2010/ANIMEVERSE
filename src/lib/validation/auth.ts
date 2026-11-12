import { z } from "zod";
import { locales } from "@/i18n/config";

// Сообщения — ключи словаря errors.*, перевод выполняется при показе.
export const emailSchema = z
  .string()
  .trim()
  .min(1, "required")
  .max(254, "tooLong")
  .pipe(z.email("invalidEmail"))
  .transform((value) => value.toLowerCase());

export const usernameSchema = z
  .string()
  .trim()
  .min(1, "required")
  .regex(/^[A-Za-z0-9_]{3,24}$/, "invalidUsername");

export const passwordSchema = z
  .string()
  .min(8, "weakPassword")
  .max(72, "tooLong")
  .refine((value) => /[A-Za-zА-Яа-яЁё]/.test(value) && /\d/.test(value), "weakPassword");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "required").max(72, "tooLong"),
});

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "required"),
    locale: z.enum(locales),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "passwordsMismatch",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  locale: z.enum(locales),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "required"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "passwordsMismatch",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "required").max(72, "tooLong"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "required"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "passwordsMismatch",
    path: ["confirmPassword"],
  })
  .refine((value) => value.password !== value.currentPassword, {
    message: "samePassword",
    path: ["password"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

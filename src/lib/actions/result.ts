import type { ZodError } from "zod";
import type { Dictionary } from "@/i18n/dictionaries";

export type ErrorKey = keyof Dictionary["errors"];

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorKey; fieldErrors?: Record<string, ErrorKey> };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: ErrorKey, fieldErrors?: Record<string, ErrorKey>): { ok: false; error: ErrorKey; fieldErrors?: Record<string, ErrorKey> } {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

const KNOWN_KEYS = new Set<string>([
  "required", "tooShort", "tooLong", "invalidEmail", "invalidUsername", "weakPassword", "passwordsMismatch",
  "samePassword", "invalidUrl", "invalidValue", "confirmMismatch",
]);

/** Ошибки Zod → ключи словаря по полям формы. */
export function zodFieldErrors(error: ZodError): Record<string, ErrorKey> {
  const out: Record<string, ErrorKey> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    if (out[path]) continue;
    out[path] = KNOWN_KEYS.has(issue.message) ? (issue.message as ErrorKey) : "invalidValue";
  }
  return out;
}

export function validationFail(error: ZodError) {
  return fail("validation", zodFieldErrors(error));
}

/** Ошибки Postgres/PostgREST → ключи словаря. Внутренние детали наружу не отдаются. */
export function mapDbError(error: { code?: string; message?: string } | null | undefined): ErrorKey {
  if (!error) return "generic";
  const message = error.message ?? "";
  if (error.code === "42501" || /forbidden|insufficient_privileges|row-level security|permission denied|protected_profile_field|cannot_/.test(message)) {
    return "forbidden";
  }
  if (error.code === "23505" || /duplicate key|already_active/.test(message)) return "duplicate";
  if (error.code === "P0002" || /not_found/.test(message)) return "notFound";
  if (error.code === "23514" || error.code === "22023" || error.code === "23502" || error.code === "22P02" || /invalid_/.test(message)) {
    return "invalidValue";
  }
  return "generic";
}

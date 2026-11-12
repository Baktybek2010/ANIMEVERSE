import type { FieldErrors, FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ErrorKey } from "@/lib/actions/result";

/** Текст ошибки поля: сообщение валидатора — это ключ словаря errors.*. */
export function fieldError<T extends FieldValues>(errors: FieldErrors<T>, name: Path<T>, t: Dictionary): string | null {
  const message = errors[name]?.message;
  if (typeof message !== "string" || !message) return null;
  return message in t.errors ? t.errors[message as ErrorKey] : t.errors.invalidValue;
}

/** Переносит серверные ошибки полей в форму. */
export function applyServerErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, ErrorKey> | undefined,
  known: readonly Path<T>[],
) {
  if (!fieldErrors) return;
  for (const [field, key] of Object.entries(fieldErrors)) {
    if ((known as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: "server", message: key });
    }
  }
}

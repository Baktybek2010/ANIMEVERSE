export type ClassValue = string | number | false | null | undefined | ClassValue[];

/** Склеивает CSS-классы, пропуская пустые значения. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value && value !== 0) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }
  return out.join(" ");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Экранирует спецсимволы шаблона LIKE/ILIKE. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Нормализует поисковый запрос: обрезает, схлопывает пробелы, ограничивает длину. */
export function normalizeQuery(value: string | null | undefined, maxLength = 80): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Безопасный внутренний путь для редиректа после входа (защита от open redirect). */
export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return fallback;
  }
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

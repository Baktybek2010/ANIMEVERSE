export type ImageKind = "jpeg" | "png" | "webp" | "avif";

const MIME: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

const EXT: Record<ImageKind, string> = { jpeg: "jpg", png: "png", webp: "webp", avif: "avif" };

/** Определяет формат изображения по сигнатуре файла (заявленному MIME-типу доверия нет). */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "png";
  }
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  if (ascii(4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(8, 4))) return "avif";
  return null;
}

export type UploadCheck =
  | { ok: true; kind: ImageKind; mime: string; extension: string; bytes: Uint8Array }
  | { ok: false; error: "fileTooLarge" | "fileType" | "required" };

/** Проверка загружаемого изображения: размер, сигнатура, допустимые форматы. */
export async function validateImageUpload(
  file: unknown,
  options: { maxBytes: number; allowed: ImageKind[] },
): Promise<UploadCheck> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "required" };
  if (file.size > options.maxBytes) return { ok: false, error: "fileTooLarge" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind || !options.allowed.includes(kind)) return { ok: false, error: "fileType" };
  return { ok: true, kind, mime: MIME[kind], extension: EXT[kind], bytes };
}

/** Проверка файла субтитров WebVTT. */
export async function validateVttUpload(
  file: unknown,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: "fileTooLarge" | "fileType" | "required" }> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "required" };
  if (file.size > maxBytes) return { ok: false, error: "fileTooLarge" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = new TextDecoder("utf-8").decode(bytes.subarray(0, 16)).replace(/^﻿/, "");
  if (!head.startsWith("WEBVTT")) return { ok: false, error: "fileType" };
  return { ok: true, bytes };
}

export const UPLOAD_LIMITS = {
  avatar: 2 * 1024 * 1024,
  poster: 5 * 1024 * 1024,
  banner: 8 * 1024 * 1024,
  subtitles: 1024 * 1024,
} as const;

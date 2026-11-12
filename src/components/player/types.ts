export type PlayerSource = {
  id: string;
  kind: "hls" | "mp4" | "webm";
  url: string;
  quality: string;
  audioLang: string;
  audioLabel: string | null;
  isDefault: boolean;
};

export type PlayerSubtitle = {
  id: string;
  lang: string;
  label: string;
  url: string;
  isDefault: boolean;
};

export type PlayerPreferences = {
  autoplayNext: boolean;
  audioLang: string;
  subtitleLang: string;
  quality: string;
};

/** Ключ аудиодорожки: язык + подпись (например, «ru · Студия X»). */
export function audioKey(source: Pick<PlayerSource, "audioLang" | "audioLabel">): string {
  return `${source.audioLang}::${source.audioLabel ?? ""}`;
}

export function qualityRank(quality: string): number {
  const match = /^(\d+)p$/.exec(quality);
  return match ? Number(match[1]) : 100000; // «auto» (адаптивный поток) — выше фиксированных
}

/**
 * Выбор стартового источника: предпочитаемая озвучка → источник по умолчанию → первый;
 * внутри озвучки — предпочитаемое качество, иначе лучшее доступное.
 */
export function pickInitialSource(sources: PlayerSource[], preferences: Pick<PlayerPreferences, "audioLang" | "quality">): PlayerSource | null {
  if (sources.length === 0) return null;
  const byAudio =
    (preferences.audioLang && sources.filter((source) => source.audioLang === preferences.audioLang)) || [];
  const defaultSource = sources.find((source) => source.isDefault) ?? sources[0];
  const pool = byAudio.length ? byAudio : sources.filter((source) => audioKey(source) === audioKey(defaultSource));
  const preferred = preferences.quality && preferences.quality !== "auto" ? pool.find((source) => source.quality === preferences.quality) : null;
  if (preferred) return preferred;
  return pool.find((source) => source.isDefault) ?? [...pool].sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality))[0];
}

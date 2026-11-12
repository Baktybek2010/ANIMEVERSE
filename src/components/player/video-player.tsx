"use client";

import type Hls from "hls.js";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { localizePath } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { fmt, formatDuration } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { clamp, cn } from "@/lib/utils";
import { audioKey, pickInitialSource, type PlayerPreferences, type PlayerSource, type PlayerSubtitle, qualityRank } from "./types";

type Props = {
  episodeId: string;
  title: string;
  poster: string | null;
  sources: PlayerSource[];
  subtitles: PlayerSubtitle[];
  startAt: number;
  nextHref: string | null;
  preferences: PlayerPreferences;
  /** Авторизован ли пользователь (прогресс сохраняется только для авторизованных). */
  canSaveProgress: boolean;
};

type MenuView = "root" | "quality" | "audio" | "subtitles" | "speed";
type Option = { id: string; label: string };

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SAVE_INTERVAL_MS = 10_000;
const AUTOPLAY_COUNTDOWN = 8;
const VIEW_AFTER_SECONDS = 20;

type SavedSettings = { volume?: number; muted?: boolean; rate?: number };

/** Настройки плеера из localStorage (громкость, скорость). */
function readSavedSettings(): SavedSettings {
  if (typeof window === "undefined") return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem("av-player") ?? "{}") as SavedSettings;
    return {
      volume: typeof saved.volume === "number" ? clamp(saved.volume, 0, 1) : undefined,
      muted: typeof saved.muted === "boolean" ? saved.muted : undefined,
      rate: typeof saved.rate === "number" && SPEEDS.includes(saved.rate) ? saved.rate : undefined,
    };
  } catch {
    return {}; // Повреждённые настройки игнорируются.
  }
}

function languageName(code: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code;
  } catch {
    return code;
  }
}

export function VideoPlayer({ episodeId, title, poster, sources, subtitles, startAt, nextHref, preferences, canSaveProgress }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const resumeRef = useRef<{ time: number; play: boolean } | null>(startAt > 5 ? { time: startAt, play: false } : null);
  const lastSavedRef = useRef({ at: 0, position: -1 });
  const watchedRef = useRef({ seconds: 0, lastTime: 0, viewSent: false });
  const recoveryRef = useRef({ network: 0, media: 0 });
  const hideTimerRef = useRef<number | null>(null);

  const [source, setSource] = useState<PlayerSource | null>(() => pickInitialSource(sources, preferences));
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(() => readSavedSettings().rate ?? 1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [menu, setMenu] = useState<MenuView | null>(null);
  const [error, setError] = useState<"network" | "media" | "generic" | null>(null);
  const [resumeNotice, setResumeNotice] = useState(startAt > 5);
  const [autoplayNext, setAutoplayNext] = useState(preferences.autoplayNext);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Дорожки адаптивного потока (HLS): качество и аудио из манифеста.
  const [hlsLevels, setHlsLevels] = useState<{ index: number; height: number }[]>([]);
  const [hlsLevel, setHlsLevel] = useState(-1);
  const [hlsAudio, setHlsAudio] = useState<{ index: number; label: string }[]>([]);
  const [hlsAudioIndex, setHlsAudioIndex] = useState(0);

  // Субтитры: файлы WebVTT загружаются и подключаются как blob-ссылки того же origin.
  const [subtitleTracks, setSubtitleTracks] = useState<{ id: string; lang: string; label: string; src: string }[]>([]);
  const [subtitleId, setSubtitleId] = useState<string>("off");

  const audioGroups = useMemo(() => {
    const groups = new Map<string, PlayerSource[]>();
    for (const item of sources) {
      const key = audioKey(item);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return groups;
  }, [sources]);

  const currentGroup = useMemo(() => (source ? (audioGroups.get(audioKey(source)) ?? []) : []), [audioGroups, source]);

  // ---------- Сохранение прогресса ----------------------------------------
  const sendProgress = useCallback(
    (options: { beacon?: boolean; view?: boolean } = {}) => {
      const video = videoRef.current;
      if (!video) return;
      const position = Math.floor(video.currentTime);
      const total = Number.isFinite(video.duration) ? Math.floor(video.duration) : 0;
      if (!options.view && (!canSaveProgress || total <= 0)) return;
      if (!options.view && !options.beacon && Math.abs(position - lastSavedRef.current.position) < 3) return;
      lastSavedRef.current = { at: Date.now(), position };
      const body = JSON.stringify({ episodeId, position, duration: total, ...(options.view ? { view: true } : {}) });
      if (options.beacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/progress", new Blob([body], { type: "application/json" }));
        return;
      }
      fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {
        // Сохранение прогресса не должно мешать просмотру; следующая попытка — по таймеру.
      });
    },
    [canSaveProgress, episodeId],
  );

  // ---------- Подключение источника ---------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;
    let cancelled = false;
    setError(null);
    setWaiting(true);
    setHlsLevels([]);
    setHlsAudio([]);
    setHlsLevel(-1);
    recoveryRef.current = { network: 0, media: 0 };

    const restore = () => {
      const pending = resumeRef.current;
      if (!pending) return;
      resumeRef.current = null;
      const total = Number.isFinite(video.duration) ? video.duration : 0;
      if (pending.time > 0 && (total === 0 || pending.time < total - 15)) video.currentTime = pending.time;
      if (pending.play) void video.play().catch(() => undefined);
    };
    video.addEventListener("loadedmetadata", restore, { once: true });

    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");
    if (source.kind === "hls" && !nativeHls) {
      void import("hls.js").then(({ default: HlsLib }) => {
        if (cancelled) return;
        if (!HlsLib.isSupported()) {
          setError("media");
          return;
        }
        const hls = new HlsLib({ enableWorker: true, capLevelToPlayerSize: true });
        hlsRef.current = hls;
        hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
          const levels = hls.levels
            .map((level, index) => ({ index, height: level.height }))
            .filter((level) => level.height > 0)
            .sort((a, b) => b.height - a.height);
          setHlsLevels(levels);
          if (preferences.quality !== "auto") {
            const wanted = levels.find((level) => `${level.height}p` === preferences.quality);
            if (wanted) {
              hls.currentLevel = wanted.index;
              setHlsLevel(wanted.index);
            }
          }
        });
        hls.on(HlsLib.Events.AUDIO_TRACKS_UPDATED, () => {
          const tracks = hls.audioTracks.map((track, index) => ({
            index,
            label: track.name || (track.lang ? languageName(track.lang, locale) : `#${index + 1}`),
          }));
          setHlsAudio(tracks);
          const preferred = hls.audioTracks.findIndex((track) => track.lang === preferences.audioLang);
          if (preferred >= 0) hls.audioTrack = preferred;
          setHlsAudioIndex(preferred >= 0 ? preferred : hls.audioTrack);
        });
        hls.on(HlsLib.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          // Одна попытка восстановления на каждый тип сбоя, затем — сообщение пользователю.
          if (data.type === HlsLib.ErrorTypes.NETWORK_ERROR && recoveryRef.current.network < 2) {
            recoveryRef.current.network += 1;
            hls.startLoad();
          } else if (data.type === HlsLib.ErrorTypes.MEDIA_ERROR && recoveryRef.current.media < 2) {
            recoveryRef.current.media += 1;
            hls.recoverMediaError();
          } else {
            setError(data.type === HlsLib.ErrorTypes.NETWORK_ERROR ? "network" : "media");
            setWaiting(false);
            hls.destroy();
            hlsRef.current = null;
          }
        });
        hls.loadSource(source.url);
        hls.attachMedia(video);
      });
    } else {
      video.src = source.url;
      video.load();
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", restore);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
    // preferences и locale читаются только при подключении источника.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, reloadKey]);

  // ---------- Загрузка субтитров ------------------------------------------
  useEffect(() => {
    if (subtitles.length === 0) return;
    const controller = new AbortController();
    const created: string[] = [];
    void Promise.all(
      subtitles.map(async (item) => {
        try {
          const response = await fetch(item.url, { signal: controller.signal });
          if (!response.ok) return null;
          const text = await response.text();
          if (!text.replace(/^﻿/, "").startsWith("WEBVTT")) return null;
          const src = URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
          created.push(src);
          return { id: item.id, lang: item.lang, label: item.label, src };
        } catch {
          return null;
        }
      }),
    ).then((loaded) => {
      if (controller.signal.aborted) return;
      const tracks = loaded.filter((track): track is NonNullable<typeof track> => track !== null);
      setSubtitleTracks(tracks);
      if (preferences.subtitleLang === "off") return;
      const preferred =
        tracks.find((track) => track.lang === preferences.subtitleLang) ??
        tracks.find((track) => subtitles.find((item) => item.id === track.id)?.isDefault);
      if (preferred) setSubtitleId(preferred.id);
    });
    return () => {
      controller.abort();
      for (const url of created) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitles]);

  // Включение выбранной дорожки субтитров.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      for (const track of Array.from(video.textTracks)) {
        track.mode = track.id === subtitleId ? "showing" : "disabled";
      }
    };
    apply();
    video.textTracks.addEventListener("addtrack", apply);
    return () => video.textTracks.removeEventListener("addtrack", apply);
  }, [subtitleId, subtitleTracks]);

  // ---------- События видео ------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      setCurrentTime(video.currentTime);
      const tracker = watchedRef.current;
      const delta = video.currentTime - tracker.lastTime;
      if (delta > 0 && delta < 2) tracker.seconds += delta;
      tracker.lastTime = video.currentTime;
      if (!tracker.viewSent && tracker.seconds >= VIEW_AFTER_SECONDS) {
        tracker.viewSent = true;
        sendProgress({ view: true });
      } else if (Date.now() - lastSavedRef.current.at >= SAVE_INTERVAL_MS) {
        sendProgress();
      }
    };
    const onProgress = () => {
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    const onDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onPlay = () => {
      setPlaying(true);
      setCountdown(null);
    };
    const onPause = () => {
      setPlaying(false);
      sendProgress();
    };
    const onWaiting = () => setWaiting(true);
    const onCanPlay = () => setWaiting(false);
    const onVolume = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onEnded = () => {
      setPlaying(false);
      sendProgress();
      if (nextHref && autoplayNext) setCountdown(AUTOPLAY_COUNTDOWN);
    };
    const onError = () => {
      if (hlsRef.current) return; // ошибки HLS обрабатывает hls.js
      const code = video.error?.code;
      if (!code) return;
      setWaiting(false);
      setError(code === MediaError.MEDIA_ERR_NETWORK ? "network" : code === MediaError.MEDIA_ERR_DECODE || code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ? "media" : "generic");
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", onProgress);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onCanPlay);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onCanPlay);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
    };
  }, [autoplayNext, nextHref, sendProgress]);

  // Сохранение при сворачивании вкладки и уходе со страницы.
  useEffect(() => {
    const flush = () => sendProgress({ beacon: true });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [sendProgress]);

  // Настройки громкости и скорости запоминаются в браузере.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const saved = readSavedSettings();
    if (saved.volume !== undefined) video.volume = saved.volume;
    if (saved.muted !== undefined) video.muted = saved.muted;
    if (saved.rate !== undefined) video.playbackRate = saved.rate;
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("av-player", JSON.stringify({ volume, muted, rate }));
    } catch {
      // Хранилище может быть недоступно (приватный режим).
    }
  }, [volume, muted, rate]);

  // Полноэкранный режим.
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Обратный отсчёт до следующей серии.
  useEffect(() => {
    if (countdown === null || !nextHref) return;
    if (countdown <= 0) {
      router.push(localizePath(locale, nextHref));
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => (value === null ? null : value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, locale, nextHref, router]);

  // ---------- Управление ---------------------------------------------------
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) setControlsVisible(false);
    }, 3200);
  }, []);

  useEffect(
    () => () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    },
    [],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || error) return;
    setResumeNotice(false);
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }, [error]);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const total = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = clamp(video.currentTime + delta, 0, total || video.currentTime + Math.max(delta, 0));
  }, []);

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = clamp(time, 0, duration || time);
    setCurrentTime(video.currentTime);
  };

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 0.5;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!container) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (container.requestFullscreen) {
      void container.requestFullscreen().catch(() => undefined);
    } else {
      video?.webkitEnterFullscreen?.(); // iPhone: полноэкранный режим только у самого <video>
    }
  }, []);

  const togglePip = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else void video.requestPictureInPicture?.().catch(() => undefined);
  };

  const switchSource = (next: PlayerSource) => {
    const video = videoRef.current;
    if (!video || next.id === source?.id) return;
    resumeRef.current = { time: video.currentTime, play: !video.paused };
    setSource(next);
  };

  const retry = () => {
    const video = videoRef.current;
    resumeRef.current = { time: video?.currentTime ?? currentTime, play: true };
    setError(null);
    setReloadKey((value) => value + 1);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const video = videoRef.current;
    switch (event.key) {
      case " ":
      case "k":
        if (target.tagName === "BUTTON" && event.key === " ") return;
        event.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        event.preventDefault();
        seekBy(10);
        break;
      case "ArrowLeft":
        event.preventDefault();
        seekBy(-10);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (video) {
          video.muted = false;
          video.volume = clamp(video.volume + 0.1, 0, 1);
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        if (video) video.volume = clamp(video.volume - 0.1, 0, 1);
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        toggleFullscreen();
        break;
      case "Escape":
        setMenu(null);
        break;
      default:
        return;
    }
    showControls();
  };

  // ---------- Пункты меню --------------------------------------------------
  const qualityOptions: Option[] = useMemo(() => {
    if (currentGroup.length > 1) {
      return [...currentGroup]
        .sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality))
        .map((item) => ({ id: `src:${item.id}`, label: item.quality === "auto" ? t.watch.qualityAuto : item.quality }));
    }
    if (hlsLevels.length > 1) {
      return [{ id: "hls:-1", label: t.watch.qualityAuto }, ...hlsLevels.map((level) => ({ id: `hls:${level.index}`, label: `${level.height}p` }))];
    }
    return [];
  }, [currentGroup, hlsLevels, t.watch.qualityAuto]);

  const currentQualityId = currentGroup.length > 1 ? `src:${source?.id}` : `hls:${hlsLevel}`;

  const audioOptions: Option[] = useMemo(() => {
    if (audioGroups.size > 1) {
      return [...audioGroups.entries()].map(([key, items]) => ({
        id: `grp:${key}`,
        label: items[0].audioLabel ? `${languageName(items[0].audioLang, locale)} · ${items[0].audioLabel}` : languageName(items[0].audioLang, locale),
      }));
    }
    if (hlsAudio.length > 1) return hlsAudio.map((track) => ({ id: `hls:${track.index}`, label: track.label }));
    return [];
  }, [audioGroups, hlsAudio, locale]);

  const currentAudioId = audioGroups.size > 1 ? `grp:${source ? audioKey(source) : ""}` : `hls:${hlsAudioIndex}`;

  const subtitleOptions: Option[] = useMemo(
    () => (subtitleTracks.length ? [{ id: "off", label: t.watch.subtitlesOff }, ...subtitleTracks.map((track) => ({ id: track.id, label: track.label }))] : []),
    [subtitleTracks, t.watch.subtitlesOff],
  );

  const selectQuality = (id: string) => {
    if (id.startsWith("src:")) {
      const next = currentGroup.find((item) => `src:${item.id}` === id);
      if (next) switchSource(next);
    } else if (hlsRef.current) {
      const index = Number(id.slice(4));
      hlsRef.current.currentLevel = index;
      setHlsLevel(index);
    }
    setMenu(null);
  };

  const selectAudio = (id: string) => {
    if (id.startsWith("grp:")) {
      const group = audioGroups.get(id.slice(4));
      if (group) {
        const sameQuality = group.find((item) => item.quality === source?.quality);
        switchSource(sameQuality ?? pickInitialSource(group, { audioLang: group[0].audioLang, quality: preferences.quality }) ?? group[0]);
      }
    } else if (hlsRef.current) {
      const index = Number(id.slice(4));
      hlsRef.current.audioTrack = index;
      setHlsAudioIndex(index);
    }
    setMenu(null);
  };

  const selectSpeed = (id: string) => {
    const speed = Number(id);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    setRate(speed);
    setMenu(null);
  };

  const label = (options: Option[], id: string) => options.find((option) => option.id === id)?.label ?? "";
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const overlayVisible = controlsVisible || !playing || menu !== null;

  const iconButton =
    "grid size-10 shrink-0 place-items-center rounded-lg text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:bg-white/15";

  const renderMenu = (view: MenuView) => {
    if (view === "root") {
      const rows: { view: MenuView; title: string; value: string; show: boolean }[] = [
        { view: "quality", title: t.watch.quality, value: label(qualityOptions, currentQualityId), show: qualityOptions.length > 0 },
        { view: "audio", title: t.watch.audio, value: label(audioOptions, currentAudioId), show: audioOptions.length > 0 },
        { view: "subtitles", title: t.watch.subtitles, value: label(subtitleOptions, subtitleId), show: subtitleOptions.length > 0 },
        { view: "speed", title: t.watch.speed, value: rate === 1 ? t.watch.speedNormal : `${rate}×`, show: true },
      ];
      return (
        <>
          {rows
            .filter((row) => row.show)
            .map((row) => (
              <button key={row.view} type="button" role="menuitem" onClick={() => setMenu(row.view)} className="flex w-full items-center justify-between gap-6 rounded-lg px-3 py-2.5 text-sm hover:bg-white/10">
                <span>{row.title}</span>
                <span className="flex items-center gap-1 text-white/60">
                  {row.value}
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              </button>
            ))}
          {nextHref ? (
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={autoplayNext}
              onClick={() => setAutoplayNext((value) => !value)}
              className="flex w-full items-center justify-between gap-6 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/10"
            >
              <span>{t.watch.autoplay}</span>
              <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", autoplayNext ? "bg-brand" : "bg-white/20")}>
                <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform", autoplayNext && "translate-x-4")} />
              </span>
            </button>
          ) : null}
        </>
      );
    }

    const config: Record<Exclude<MenuView, "root">, { title: string; options: Option[]; current: string; select: (id: string) => void }> = {
      quality: { title: t.watch.quality, options: qualityOptions, current: currentQualityId, select: selectQuality },
      audio: { title: t.watch.audio, options: audioOptions, current: currentAudioId, select: selectAudio },
      subtitles: {
        title: t.watch.subtitles,
        options: subtitleOptions,
        current: subtitleId,
        select: (id) => {
          setSubtitleId(id);
          setMenu(null);
        },
      },
      speed: {
        title: t.watch.speed,
        options: SPEEDS.map((speed) => ({ id: String(speed), label: speed === 1 ? t.watch.speedNormal : `${speed}×` })),
        current: String(rate),
        select: selectSpeed,
      },
    };
    const section = config[view];
    return (
      <>
        <button type="button" onClick={() => setMenu("root")} className="mb-1 flex w-full items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-white/10">
          <ChevronLeft className="size-4" aria-hidden />
          {section.title}
        </button>
        {section.options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="menuitemradio"
            aria-checked={option.id === section.current}
            onClick={() => section.select(option.id)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/10"
          >
            <Check className={cn("size-4", option.id === section.current ? "text-brand-soft" : "invisible")} aria-hidden />
            {option.label}
          </button>
        ))}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={title}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={showControls}
      onPointerLeave={() => playing && setControlsVisible(false)}
      className={cn(
        "group/player relative aspect-video w-full overflow-hidden bg-black outline-none select-none sm:rounded-2xl",
        fullscreen && "rounded-none",
        !overlayVisible && "cursor-none",
      )}
      data-testid="video-player"
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        className="absolute inset-0 size-full"
        onClick={() => {
          if (menu) setMenu(null);
          else togglePlay();
          showControls();
        }}
        onDoubleClick={toggleFullscreen}
      >
        {subtitleTracks.map((track) => (
          <track key={track.id} id={track.id} kind="subtitles" src={track.src} srcLang={track.lang} label={track.label} />
        ))}
      </video>

      {/* Индикатор загрузки */}
      {waiting && !error ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-label={t.common.loading}>
          <LoaderCircle className="size-12 animate-spin text-white/90 drop-shadow" aria-hidden />
        </div>
      ) : null}

      {/* Большая кнопка воспроизведения */}
      {!playing && !waiting && !error && countdown === null ? (
        <button type="button" onClick={togglePlay} aria-label={t.watch.play} className="absolute inset-0 grid place-items-center">
          <span className="bg-brand-gradient grid size-18 place-items-center rounded-full text-white shadow-glow transition-transform hover:scale-105">
            <Play className="size-8 translate-x-0.5 fill-current" aria-hidden />
          </span>
        </button>
      ) : null}

      {/* Продолжение с сохранённого места */}
      {resumeNotice && !error ? (
        <div className="glass absolute top-4 left-4 z-20 flex items-center gap-3 rounded-xl border border-line-strong px-3.5 py-2 text-sm" role="status">
          <span>{fmt(t.watch.resumeFrom, { time: formatDuration(startAt) })}</span>
          <button
            type="button"
            onClick={() => {
              resumeRef.current = null;
              seekTo(0);
              setResumeNotice(false);
            }}
            className="font-medium text-brand-soft hover:underline"
          >
            {t.watch.startOver}
          </button>
        </div>
      ) : null}

      {/* Ошибка потока */}
      {error ? (
        <div role="alert" className="absolute inset-0 z-30 grid place-items-center bg-black/85 p-6 text-center">
          <div className="max-w-sm">
            <CircleAlert className="mx-auto size-11 text-danger" aria-hidden />
            <p className="mt-3 font-display text-lg font-semibold">{t.watch.errorTitle}</p>
            <p className="mt-1.5 text-sm text-muted">
              {error === "network" ? t.watch.errorNetwork : error === "media" ? t.watch.errorMedia : t.watch.errorText}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={retry}>{t.watch.retry}</Button>
              {sources
                .filter((item) => item.id !== source?.id)
                .slice(0, 2)
                .map((item) => (
                  <Button key={item.id} variant="secondary" onClick={() => switchSource(item)}>
                    {[languageName(item.audioLang, locale), item.quality === "auto" ? null : item.quality].filter(Boolean).join(" · ")}
                  </Button>
                ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Автопереход к следующей серии */}
      {countdown !== null && nextHref ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/80 p-6 text-center" role="status">
          <div>
            <p className="font-display text-lg font-semibold">{fmt(t.watch.nextIn, { seconds: countdown })}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={() => router.push(localizePath(locale, nextHref))}>
                <SkipForward className="size-4 fill-current" aria-hidden />
                {t.watch.playNow}
              </Button>
              <Button variant="secondary" onClick={() => setCountdown(null)}>
                {t.watch.cancelAutoplay}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Панель управления */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pt-14 pb-2 transition-opacity duration-300 sm:px-4 sm:pb-3",
          overlayVisible && !error ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="group/seek relative mb-1 flex h-5 items-center">
          <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/25 transition-[height] group-hover/seek:h-1.5">
            <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${bufferedPercent}%` }} />
            <div className="bg-brand-gradient absolute inset-y-0 left-0" style={{ width: `${progressPercent}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seekTo(Number(event.target.value))}
            aria-label={t.watch.seek}
            aria-valuetext={`${formatDuration(currentTime)} / ${formatDuration(duration)}`}
            className="absolute inset-x-0 h-5 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
          />
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <button type="button" onClick={togglePlay} aria-label={playing ? t.watch.pause : t.watch.play} className={iconButton}>
            {playing ? <Pause className="size-5 fill-current" aria-hidden /> : <Play className="size-5 fill-current" aria-hidden />}
          </button>
          <button type="button" onClick={() => seekBy(-10)} aria-label={t.watch.rewind} className={cn(iconButton, "hidden sm:grid")}>
            <RotateCcw className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => seekBy(10)} aria-label={t.watch.forward} className={cn(iconButton, "hidden sm:grid")}>
            <RotateCw className="size-5" aria-hidden />
          </button>
          {nextHref ? (
            <button type="button" onClick={() => router.push(localizePath(locale, nextHref))} aria-label={t.watch.next} className={iconButton}>
              <SkipForward className="size-5 fill-current" aria-hidden />
            </button>
          ) : null}

          <div className="group/volume flex items-center">
            <button type="button" onClick={toggleMute} aria-label={muted ? t.watch.unmute : t.watch.mute} className={iconButton}>
              <VolumeIcon className="size-5" aria-hidden />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => {
                const video = videoRef.current;
                if (!video) return;
                video.volume = Number(event.target.value);
                video.muted = video.volume === 0;
              }}
              aria-label={t.watch.volume}
              className="hidden h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 group-hover/volume:w-20 group-hover/volume:opacity-100 sm:block [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          <span className="ml-1.5 text-xs text-white/90 tabular-nums sm:text-sm" aria-hidden>
            {formatDuration(currentTime)} <span className="text-white/50">/ {formatDuration(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <div className="relative">
              <button
                type="button"
                aria-label={t.watch.settings}
                aria-haspopup="menu"
                aria-expanded={menu !== null}
                onClick={() => setMenu((value) => (value ? null : "root"))}
                className={iconButton}
              >
                <Settings className={cn("size-5 transition-transform", menu && "rotate-45")} aria-hidden />
              </button>
              {menu ? (
                <div role="menu" className="absolute right-0 bottom-12 max-h-[60cqh] w-64 overflow-y-auto rounded-xl border border-white/15 bg-black/90 p-1.5 text-white shadow-card backdrop-blur-xl">
                  {renderMenu(menu)}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={togglePip} aria-label={t.watch.pip} className={cn(iconButton, "hidden sm:grid")}>
              <PictureInPicture2 className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? t.watch.exitFullscreen : t.watch.fullscreen} className={iconButton}>
              {fullscreen ? <Minimize className="size-5" aria-hidden /> : <Maximize className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

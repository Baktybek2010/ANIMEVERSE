"use client";

import { ChevronDown, Crown, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useAdminI18n } from "@/i18n/admin-client";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/misc";
import {
  deleteEpisodeAction, deleteSeasonAction, deleteSourceAction, deleteSubtitleAction,
  saveEpisodeAction, saveSeasonAction, saveSourceAction, saveSubtitleAction,
} from "@/lib/actions/admin/anime";
import type { AdminEpisode, AdminSeason } from "@/lib/data/admin";
import { useRun } from "./use-run";

type SeasonForm = { number: string; title_ru: string; title_en: string; title_ja: string };
type EpisodeForm = {
  number: string; title_ru: string; title_en: string; title_ja: string; description: string;
  thumbnail_url: string; duration_seconds: string; air_date: string; is_premium: boolean; is_published: boolean;
};

const emptySource = { kind: "hls", url: "", quality: "auto", audio_lang: "ja", audio_label: "", is_default: false };
const emptySubtitle = { lang: "ru", label: "", url: "", is_default: false };

function SeasonDialog({ animeId, season, nextNumber, onClose }: { animeId: string; season: AdminSeason | null; nextNumber: number; onClose: () => void }) {
  const a = useAdminI18n();
  const { t } = useI18n();
  const { run, pending, errorOf } = useRun();
  const [values, setValues] = useState<SeasonForm>({
    number: String(season?.number ?? nextNumber),
    title_ru: season?.title_ru ?? "",
    title_en: season?.title_en ?? "",
    title_ja: season?.title_ja ?? "",
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await run(() => saveSeasonAction(animeId, season?.id ?? null, values), { success: t.common.saved })) onClose();
  };
  return (
    <Dialog open onClose={onClose} title={season ? fmt(a.anime.seasonN, { number: season.number }) : a.anime.addSeason}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label={a.anime.seasonNumber} htmlFor="season-number" error={errorOf("number")} required>
          <Input id="season-number" type="number" min={0} max={100} value={values.number} onChange={(event) => setValues({ ...values, number: event.target.value })} required />
        </Field>
        {(["ru", "en", "ja"] as const).map((lang) => (
          <Field key={lang} label={`${a.anime.seasonTitle} · ${a.common[lang]}`} htmlFor={`season-title-${lang}`}>
            <Input id={`season-title-${lang}`} lang={lang} value={values[`title_${lang}`]} onChange={(event) => setValues({ ...values, [`title_${lang}`]: event.target.value })} />
          </Field>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" loading={pending}>{t.common.save}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function EpisodeDialog({ seasonId, episode, nextNumber, onClose }: { seasonId: string; episode: AdminEpisode | null; nextNumber: number; onClose: () => void }) {
  const a = useAdminI18n();
  const { t } = useI18n();
  const { run, pending, errorOf } = useRun();
  const [values, setValues] = useState<EpisodeForm>({
    number: String(episode?.number ?? nextNumber),
    title_ru: episode?.title_ru ?? "",
    title_en: episode?.title_en ?? "",
    title_ja: episode?.title_ja ?? "",
    description: episode?.description ?? "",
    thumbnail_url: episode?.thumbnail_url ?? "",
    duration_seconds: episode?.duration_seconds ? String(episode.duration_seconds) : "",
    air_date: episode?.air_date ?? "",
    is_premium: episode?.is_premium ?? false,
    is_published: episode?.is_published ?? false,
  });
  const set = (patch: Partial<EpisodeForm>) => setValues((current) => ({ ...current, ...patch }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await run(() => saveEpisodeAction(seasonId, episode?.id ?? null, values), { success: t.common.saved })) onClose();
  };
  return (
    <Dialog open onClose={onClose} title={episode ? fmt(a.anime.editEpisode, { number: episode.number }) : a.anime.addEpisode} className="w-[min(92vw,40rem)]">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={a.anime.episodeNumber} htmlFor="episode-number" error={errorOf("number")} required>
          <Input id="episode-number" type="number" min={0} max={5000} value={values.number} onChange={(event) => set({ number: event.target.value })} required />
        </Field>
        <Field label={a.anime.airDate} htmlFor="episode-air-date" error={errorOf("air_date")}>
          <Input id="episode-air-date" type="date" value={values.air_date} onChange={(event) => set({ air_date: event.target.value })} />
        </Field>
        {(["ru", "en", "ja"] as const).map((lang) => (
          <Field key={lang} label={`${a.anime.episodeTitle} · ${a.common[lang]}`} htmlFor={`episode-title-${lang}`} className={lang === "ru" ? "sm:col-span-2" : undefined}>
            <Input id={`episode-title-${lang}`} lang={lang} value={values[`title_${lang}`]} onChange={(event) => set({ [`title_${lang}`]: event.target.value })} />
          </Field>
        ))}
        <Field label={a.anime.duration} htmlFor="episode-duration" error={errorOf("duration_seconds")}>
          <Input id="episode-duration" type="number" min={0} value={values.duration_seconds} onChange={(event) => set({ duration_seconds: event.target.value })} />
        </Field>
        <Field label={a.anime.thumbnail} htmlFor="episode-thumbnail" error={errorOf("thumbnail_url")}>
          <Input id="episode-thumbnail" type="url" placeholder="https://…" value={values.thumbnail_url} onChange={(event) => set({ thumbnail_url: event.target.value })} />
        </Field>
        <Field label={a.anime.episodeDescription} htmlFor="episode-description" className="sm:col-span-2">
          <Textarea id="episode-description" rows={3} value={values.description} onChange={(event) => set({ description: event.target.value })} />
        </Field>
        <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-2">
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox checked={values.is_published} onChange={(event) => set({ is_published: event.target.checked })} />
            {a.anime.episodePublished}
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox checked={values.is_premium} onChange={(event) => set({ is_premium: event.target.checked })} />
            {a.anime.isPremium}
          </label>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" loading={pending}>{t.common.save}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Источники видео и субтитры одного эпизода. */
function EpisodeMedia({ episode }: { episode: AdminEpisode }) {
  const a = useAdminI18n();
  const { t } = useI18n();
  const { run, pending, errorOf } = useRun();
  const [source, setSource] = useState(emptySource);
  const [subtitle, setSubtitle] = useState(emptySubtitle);
  const [file, setFile] = useState<File | null>(null);

  const addSource = async (event: FormEvent) => {
    event.preventDefault();
    if (await run(() => saveSourceAction(episode.id, source), { success: t.common.saved })) setSource(emptySource);
  };
  const addSubtitle = async (event: FormEvent) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("episodeId", episode.id);
    formData.set("lang", subtitle.lang);
    formData.set("label", subtitle.label);
    formData.set("url", subtitle.url);
    formData.set("is_default", String(subtitle.is_default));
    if (file) formData.set("file", file);
    if (await run(() => saveSubtitleAction(formData), { success: t.common.saved })) {
      setSubtitle(emptySubtitle);
      setFile(null);
    }
  };

  return (
    <div className="grid gap-6 border-t border-line bg-black/20 p-4 lg:grid-cols-2">
      <section>
        <h4 className="text-sm font-semibold">{a.anime.sources}</h4>
        <p className="mt-1 text-xs text-dim">{a.anime.sourcesHint}</p>
        {episode.episode_sources.length === 0 ? (
          <p className="mt-3 text-sm text-gold">{a.anime.noSources}</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {episode.episode_sources.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-sm">
                <Badge tone="brand">{item.kind.toUpperCase()}</Badge>
                <Badge>{item.quality}</Badge>
                <Badge tone="sky">{item.audio_label ? `${item.audio_lang} · ${item.audio_label}` : item.audio_lang}</Badge>
                {item.is_default ? <Badge tone="success">{a.anime.sourceDefault}</Badge> : null}
                <span className="min-w-0 flex-1 truncate text-xs text-dim" title={item.url}>{item.url}</span>
                <button type="button" disabled={pending} onClick={() => run(() => deleteSourceAction(item.id), { success: t.common.deleted })} aria-label={t.common.delete} className="grid size-7 shrink-0 place-items-center rounded-md text-dim hover:bg-white/10 hover:text-danger">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addSource} className="mt-3 grid gap-2 sm:grid-cols-4">
          <Field label={a.anime.sourceUrl} htmlFor={`src-url-${episode.id}`} error={errorOf("url")} className="sm:col-span-4">
            <Input id={`src-url-${episode.id}`} type="url" placeholder="https://…/master.m3u8" value={source.url} onChange={(event) => setSource({ ...source, url: event.target.value })} required />
          </Field>
          <Field label={a.anime.sourceKind} htmlFor={`src-kind-${episode.id}`}>
            <Select id={`src-kind-${episode.id}`} value={source.kind} onChange={(event) => setSource({ ...source, kind: event.target.value })}>
              <option value="hls">HLS</option>
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
            </Select>
          </Field>
          <Field label={a.anime.sourceQuality} htmlFor={`src-quality-${episode.id}`} error={errorOf("quality")}>
            <Select id={`src-quality-${episode.id}`} value={source.quality} onChange={(event) => setSource({ ...source, quality: event.target.value })}>
              {["auto", "2160p", "1440p", "1080p", "720p", "480p", "360p"].map((quality) => (
                <option key={quality} value={quality}>{quality}</option>
              ))}
            </Select>
          </Field>
          <Field label={a.anime.sourceAudioLang} htmlFor={`src-lang-${episode.id}`} error={errorOf("audio_lang")}>
            <Input id={`src-lang-${episode.id}`} value={source.audio_lang} maxLength={12} onChange={(event) => setSource({ ...source, audio_lang: event.target.value })} required />
          </Field>
          <Field label={a.anime.sourceAudioLabel} htmlFor={`src-label-${episode.id}`}>
            <Input id={`src-label-${episode.id}`} value={source.audio_label} maxLength={80} onChange={(event) => setSource({ ...source, audio_label: event.target.value })} />
          </Field>
          <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
            <Checkbox checked={source.is_default} onChange={(event) => setSource({ ...source, is_default: event.target.checked })} />
            {a.anime.sourceDefault}
          </label>
          <div className="sm:col-span-2 sm:text-right">
            <Button type="submit" size="sm" variant="secondary" loading={pending}>
              <Plus className="size-4" aria-hidden />
              {a.anime.addSource}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h4 className="text-sm font-semibold">{a.anime.subtitles}</h4>
        {episode.episode_subtitles.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{a.anime.noSubtitles}</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {episode.episode_subtitles.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-sm">
                <Badge tone="sky">{item.lang}</Badge>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.is_default ? <Badge tone="success">{a.anime.sourceDefault}</Badge> : null}
                <button type="button" disabled={pending} onClick={() => run(() => deleteSubtitleAction(item.id), { success: t.common.deleted })} aria-label={t.common.delete} className="grid size-7 shrink-0 place-items-center rounded-md text-dim hover:bg-white/10 hover:text-danger">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addSubtitle} className="mt-3 grid gap-2 sm:grid-cols-2">
          <Field label={a.anime.subtitleLang} htmlFor={`sub-lang-${episode.id}`} error={errorOf("lang")}>
            <Input id={`sub-lang-${episode.id}`} value={subtitle.lang} maxLength={12} onChange={(event) => setSubtitle({ ...subtitle, lang: event.target.value })} required />
          </Field>
          <Field label={a.anime.subtitleLabel} htmlFor={`sub-label-${episode.id}`} error={errorOf("label")}>
            <Input id={`sub-label-${episode.id}`} value={subtitle.label} maxLength={80} onChange={(event) => setSubtitle({ ...subtitle, label: event.target.value })} required />
          </Field>
          <Field label={a.anime.subtitleFile} htmlFor={`sub-file-${episode.id}`} className="sm:col-span-2">
            <input
              id={`sub-file-${episode.id}`}
              type="file"
              accept=".vtt,text/vtt"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-fg hover:file:bg-white/15"
            />
          </Field>
          <Field label={`${a.common.orUrl}: ${a.anime.subtitleUrl}`} htmlFor={`sub-url-${episode.id}`} error={errorOf("url")} className="sm:col-span-2">
            <Input id={`sub-url-${episode.id}`} type="url" placeholder="https://…/subs.vtt" value={subtitle.url} onChange={(event) => setSubtitle({ ...subtitle, url: event.target.value })} />
          </Field>
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox checked={subtitle.is_default} onChange={(event) => setSubtitle({ ...subtitle, is_default: event.target.checked })} />
            {a.anime.sourceDefault}
          </label>
          <div className="sm:text-right">
            <Button type="submit" size="sm" variant="secondary" loading={pending}>
              <Plus className="size-4" aria-hidden />
              {a.anime.addSubtitle}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function EpisodesManager({ animeId, seasons }: { animeId: string; seasons: AdminSeason[] }) {
  const a = useAdminI18n();
  const { t } = useI18n();
  const { run } = useRun();
  const [seasonDialog, setSeasonDialog] = useState<{ season: AdminSeason | null } | null>(null);
  const [episodeDialog, setEpisodeDialog] = useState<{ season: AdminSeason; episode: AdminEpisode | null } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{a.anime.episodesSection}</h2>
        <Button variant="secondary" size="sm" onClick={() => setSeasonDialog({ season: null })}>
          <Plus className="size-4" aria-hidden />
          {a.anime.addSeason}
        </Button>
      </div>

      {seasons.length === 0 ? <p className="text-sm text-muted">{a.anime.noSeasons}</p> : null}

      <div className="space-y-5">
        {seasons.map((season) => (
          <section key={season.id} className="overflow-hidden rounded-xl border border-line">
            <header className="flex flex-wrap items-center gap-2 bg-white/[0.04] px-4 py-3">
              <h3 className="font-semibold">
                {fmt(a.anime.seasonN, { number: season.number })}
                {season.title_ru || season.title_en ? <span className="ml-2 font-normal text-muted">{season.title_ru || season.title_en}</span> : null}
              </h3>
              <span className="text-xs text-dim">{fmt(a.anime.episodesCount, { count: season.episodes.length })}</span>
              <div className="ml-auto flex flex-wrap gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setSeasonDialog({ season })}>
                  <Pencil className="size-4" aria-hidden />
                  {t.common.edit}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEpisodeDialog({ season, episode: null })}>
                  <Plus className="size-4" aria-hidden />
                  {a.anime.addEpisode}
                </Button>
                <ConfirmButton
                  title={a.anime.deleteSeason}
                  description={a.anime.deleteSeasonText}
                  confirmLabel={t.common.delete}
                  aria-label={a.anime.deleteSeason}
                  onConfirm={async () => {
                    await run(() => deleteSeasonAction(season.id), { success: t.common.deleted });
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </ConfirmButton>
              </div>
            </header>

            {season.episodes.length === 0 ? <p className="px-4 py-4 text-sm text-muted">{a.anime.noEpisodes}</p> : null}
            <ul className="divide-y divide-line">
              {season.episodes.map((episode) => {
                const open = expanded === episode.id;
                return (
                  <li key={episode.id}>
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : episode.id)}
                        aria-expanded={open}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left text-sm hover:text-brand-soft"
                      >
                        <ChevronDown className={`size-4 shrink-0 text-dim transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                        <span className="font-medium whitespace-nowrap">{fmt(a.anime.editEpisode, { number: episode.number })}</span>
                        <span className="truncate text-muted">{episode.title_ru || episode.title_en || episode.title_ja}</span>
                      </button>
                      <Badge tone={episode.is_published ? "success" : "neutral"}>{episode.is_published ? a.common.published : a.common.draft}</Badge>
                      {episode.is_premium ? (
                        <Badge tone="gold">
                          <Crown className="size-3" aria-hidden />
                          Premium
                        </Badge>
                      ) : null}
                      <Badge tone={episode.episode_sources.length ? "sky" : "danger"}>
                        {a.anime.sources}: {episode.episode_sources.length}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => setEpisodeDialog({ season, episode })} aria-label={`${t.common.edit}: ${fmt(a.anime.editEpisode, { number: episode.number })}`}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <ConfirmButton
                        title={a.common.confirmDelete}
                        description={a.common.confirmDeleteText}
                        confirmLabel={t.common.delete}
                        variant="ghost"
                        aria-label={`${t.common.delete}: ${fmt(a.anime.editEpisode, { number: episode.number })}`}
                        onConfirm={async () => {
                          await run(() => deleteEpisodeAction(episode.id), { success: t.common.deleted });
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </ConfirmButton>
                    </div>
                    {open ? <EpisodeMedia episode={episode} /> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {seasonDialog ? (
        <SeasonDialog
          animeId={animeId}
          season={seasonDialog.season}
          nextNumber={Math.max(0, ...seasons.map((season) => season.number)) + 1}
          onClose={() => setSeasonDialog(null)}
        />
      ) : null}
      {episodeDialog ? (
        <EpisodeDialog
          seasonId={episodeDialog.season.id}
          episode={episodeDialog.episode}
          nextNumber={Math.max(0, ...episodeDialog.season.episodes.map((episode) => episode.number)) + 1}
          onClose={() => setEpisodeDialog(null)}
        />
      ) : null}
    </Card>
  );
}

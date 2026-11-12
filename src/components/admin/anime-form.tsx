"use client";

import { ExternalLink, RefreshCw, Trash2, Unlock } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { localizePath } from "@/i18n/config";
import { useAdminI18n } from "@/i18n/admin-client";
import { useI18n } from "@/i18n/client";
import { fmt, formatDateTime } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { ButtonLink } from "@/components/ui/link";
import { Badge, Card } from "@/components/ui/misc";
import { deleteAnimeAction, resyncAnimeAction, saveAnimeAction, unlockAnimeFieldsAction } from "@/lib/actions/admin/anime";
import { ANIME_FORMATS, ANIME_SEASONS, ANIME_STATUSES } from "@/lib/data/types";
import type { AnimeInput } from "@/lib/validation/admin";
import { cn } from "@/lib/utils";
import { ImageField } from "./image-field";
import { useRun } from "./use-run";

export type AnimeFormValues = Omit<AnimeInput, "genre_ids" | "synonyms"> & { genre_ids: number[]; synonyms: string };

type Props = {
  id: string | null;
  initial: AnimeFormValues;
  genres: { id: number; name: string }[];
  meta?: { anilistId: number | null; syncedAt: string | null; lockedFields: string[]; canDelete: boolean; publishedSlug: string | null };
};

export function AnimeForm({ id, initial, genres, meta }: Props) {
  const a = useAdminI18n();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { run, pending, errorOf } = useRun();
  const [values, setValues] = useState<AnimeFormValues>(initial);

  const set = <K extends keyof AnimeFormValues>(key: K, value: AnimeFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const str = (key: keyof AnimeFormValues) => String(values[key] ?? "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(() => saveAnimeAction(id, values), {
      success: id ? t.common.saved : a.anime.created,
      onSuccess: (data) => {
        if (!id) router.replace(localizePath(locale, `/admin/anime/${data.id}`));
      },
    });
  };

  const textField = (key: keyof AnimeFormValues, label: string, options: { required?: boolean; hint?: string; type?: string; className?: string; lang?: string } = {}) => (
    <Field label={label} htmlFor={`anime-${key}`} error={errorOf(key)} hint={options.hint} required={options.required} className={options.className}>
      <Input
        id={`anime-${key}`}
        type={options.type ?? "text"}
        lang={options.lang}
        value={str(key)}
        onChange={(event) => set(key, event.target.value as never)}
        aria-invalid={Boolean(errorOf(key))}
        required={options.required}
      />
    </Field>
  );

  const area = (key: keyof AnimeFormValues, label: string, lang: string) => (
    <Field label={label} htmlFor={`anime-${key}`} error={errorOf(key)}>
      <Textarea id={`anime-${key}`} lang={lang} rows={5} value={str(key)} onChange={(event) => set(key, event.target.value as never)} />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {meta?.anilistId ? (
        <Card className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <Badge tone="sky">{a.anime.anilist}</Badge>
              <a href={`https://anilist.co/anime/${meta.anilistId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-brand-soft">
                {fmt(a.anime.anilistLinked, { id: meta.anilistId })}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </p>
            <p className="mt-1 text-xs text-dim">{fmt(a.anime.anilistSynced, { date: meta.syncedAt ? formatDateTime(locale, meta.syncedAt) : a.anime.anilistNever })}</p>
            {meta.lockedFields.length ? (
              <p className="mt-2 text-xs text-muted">
                {a.anime.lockedFields}: <span className="text-gold">{meta.lockedFields.join(", ")}</span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {meta.lockedFields.length ? (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => unlockAnimeFieldsAction(id), { success: a.anime.unlocked })}>
                <Unlock className="size-4" aria-hidden />
                {a.anime.unlock}
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => resyncAnimeAction(id, false), { success: a.anime.resynced, onSuccess: () => window.location.reload() })}>
              <RefreshCw className="size-4" aria-hidden />
              {a.anime.resync}
            </Button>
            <ConfirmButton
              variant="outline"
              title={a.anime.forceResync}
              description={a.anime.forceResyncText}
              confirmLabel={a.anime.forceResync}
              onConfirm={async () => {
                await run(() => resyncAnimeAction(id, true), { success: a.anime.resynced, onSuccess: () => window.location.reload() });
              }}
            >
              {a.anime.forceResync}
            </ConfirmButton>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold">{a.anime.main}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {textField("title_romaji", a.anime.titleRomaji, { required: true })}
          {textField("slug", a.anime.slug, { hint: a.anime.slugHint })}
          <Field label={a.anime.format} htmlFor="anime-format">
            <Select id="anime-format" value={values.format} onChange={(event) => set("format", event.target.value)}>
              {ANIME_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {t.formats[format]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={a.anime.status} htmlFor="anime-status">
            <Select id="anime-status" value={values.status} onChange={(event) => set("status", event.target.value)}>
              {ANIME_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t.statuses[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={a.anime.season} htmlFor="anime-season">
            <Select id="anime-season" value={values.season ?? ""} onChange={(event) => set("season", event.target.value)}>
              <option value="">{a.anime.seasonNone}</option>
              {ANIME_SEASONS.map((season) => (
                <option key={season} value={season}>
                  {t.seasons[season]}
                </option>
              ))}
            </Select>
          </Field>
          {textField("season_year", a.anime.year, { type: "number" })}
          {textField("start_date", a.anime.startDate, { type: "date" })}
          {textField("end_date", a.anime.endDate, { type: "date" })}
          {textField("episodes_total", a.anime.episodesTotal, { type: "number" })}
          {textField("episode_duration", a.anime.episodeDuration, { type: "number" })}
          {textField("score", a.anime.score, { type: "number" })}
          {textField("studio", a.anime.studio)}
          {textField("source", a.anime.source)}
          {textField("trailer_youtube_id", a.anime.trailer)}
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium text-fg/90">{a.anime.genres}</legend>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((genre) => {
              const active = values.genre_ids.includes(genre.id);
              return (
                <button
                  key={genre.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set("genre_ids", active ? values.genre_ids.filter((item) => item !== genre.id) : [...values.genre_ids, genre.id])}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    active ? "border-transparent bg-brand-gradient font-medium text-white" : "border-line text-muted hover:border-brand-soft/50 hover:text-fg",
                  )}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
          {(
            [
              ["is_published", a.anime.isPublished],
              ["is_featured", a.anime.isFeatured],
              ["is_adult", a.anime.isAdult],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2.5 text-sm">
              <Checkbox checked={values[key]} onChange={(event) => set(key, event.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold">{a.anime.media}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <ImageField id="anime-poster" kind="poster" label={a.anime.poster} hint={a.anime.posterHint} value={str("poster_url")} onChange={(url) => set("poster_url", url)} error={errorOf("poster_url")} />
          <ImageField id="anime-banner" kind="banner" label={a.anime.banner} hint={a.anime.bannerHint} value={str("banner_url")} onChange={(url) => set("banner_url", url)} error={errorOf("banner_url")} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold">{a.anime.translations}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {textField("title_ru", a.anime.titleRu, { lang: "ru" })}
          {textField("title_english", a.anime.titleEnglish, { lang: "en" })}
          {textField("title_native", a.anime.titleNative, { lang: "ja" })}
          {area("description_ru", a.anime.descriptionRu, "ru")}
          {area("description_en", a.anime.descriptionEn, "en")}
          {area("description_ja", a.anime.descriptionJa, "ja")}
        </div>
        <Field label={a.anime.synonyms} htmlFor="anime-synonyms" hint={a.anime.synonymsHint} className="mt-4">
          <Textarea id="anime-synonyms" rows={3} value={values.synonyms} onChange={(event) => set("synonyms", event.target.value)} />
        </Field>
      </Card>

      <div className="glass sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-line-strong p-3">
        <Button type="submit" loading={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
        {meta?.publishedSlug ? (
          <ButtonLink href={`/anime/${meta.publishedSlug}`} variant="ghost" target="_blank">
            <ExternalLink className="size-4" aria-hidden />
            {a.common.view}
          </ButtonLink>
        ) : null}
        {id && meta?.canDelete ? (
          <ConfirmButton
            className="ml-auto"
            title={a.common.confirmDelete}
            description={a.anime.deleteText}
            confirmLabel={t.common.delete}
            onConfirm={async () => {
              await run(() => deleteAnimeAction(id), {
                success: a.anime.deleted,
                refresh: false,
                onSuccess: () => router.replace(localizePath(locale, "/admin/anime")),
              });
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            {t.common.delete}
          </ConfirmButton>
        ) : null}
      </div>
    </form>
  );
}

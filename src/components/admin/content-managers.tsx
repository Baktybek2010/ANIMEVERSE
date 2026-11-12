"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { localizePath } from "@/i18n/config";
import { useAdminI18n } from "@/i18n/admin-client";
import { useI18n } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import {
  deleteBannerAction, deleteGenreAction, deleteNewsAction, saveBannerAction, saveGenreAction, saveNewsAction, savePlanAction, saveSettingsAction,
} from "@/lib/actions/admin/content";
import type { AdminBanner } from "@/lib/data/admin";
import type { Tables } from "@/lib/supabase/types";
import type { BannerInput, GenreInput, NewsInput, PlanInput, SettingsInput } from "@/lib/validation/admin";
import { ImageField } from "./image-field";
import { EmptyRow, TableWrap } from "./ui";
import { useRun } from "./use-run";

const LANGS = ["ru", "en", "ja"] as const;

// ---------- Жанры ----------------------------------------------------------

type Genre = Pick<Tables<"genres">, "id" | "slug" | "name_ru" | "name_en" | "name_ja">;

export function GenresManager({ genres, canDelete }: { genres: Genre[]; canDelete: boolean }) {
  const a = useAdminI18n();
  const { t } = useI18n();
  const { run, pending, errorOf } = useRun();
  const [editing, setEditing] = useState<{ id: number | null; values: GenreInput } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (await run(() => saveGenreAction(editing.id, editing.values), { success: a.genres.saved })) setEditing(null);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ id: null, values: { slug: "", name_ru: "", name_en: "", name_ja: "" } })}>
          <Plus className="size-4" aria-hidden />
          {a.genres.add}
        </Button>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <th scope="col">{a.genres.slug}</th>
            <th scope="col">{a.common.ru}</th>
            <th scope="col">{a.common.en}</th>
            <th scope="col">{a.common.ja}</th>
            <th scope="col" className="text-right">{a.common.actions}</th>
          </tr>
        </thead>
        <tbody>
          {genres.length === 0 ? <EmptyRow colSpan={5} text={a.common.noData} /> : null}
          {genres.map((genre) => (
            <tr key={genre.id}>
              <td><code className="text-xs text-brand-soft">{genre.slug}</code></td>
              <td>{genre.name_ru}</td>
              <td>{genre.name_en}</td>
              <td lang="ja">{genre.name_ja}</td>
              <td>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" aria-label={`${t.common.edit}: ${genre.name_en}`} onClick={() => setEditing({ id: genre.id, values: { slug: genre.slug, name_ru: genre.name_ru, name_en: genre.name_en, name_ja: genre.name_ja } })}>
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  {canDelete ? (
                    <ConfirmButton variant="ghost" title={a.common.confirmDelete} description={a.common.confirmDeleteText} confirmLabel={t.common.delete} aria-label={`${t.common.delete}: ${genre.name_en}`} onConfirm={async () => { await run(() => deleteGenreAction(genre.id), { success: a.genres.deleted }); }}>
                      <Trash2 className="size-4" aria-hidden />
                    </ConfirmButton>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {editing ? (
        <Dialog open onClose={() => setEditing(null)} title={editing.id ? t.common.edit : a.genres.add}>
          <form onSubmit={submit} className="grid gap-4">
            <Field label={a.genres.slug} htmlFor="genre-slug" error={errorOf("slug")} required>
              <Input id="genre-slug" value={editing.values.slug} onChange={(event) => setEditing({ ...editing, values: { ...editing.values, slug: event.target.value } })} required />
            </Field>
            {LANGS.map((lang) => (
              <Field key={lang} label={a.genres[`name${lang === "ru" ? "Ru" : lang === "en" ? "En" : "Ja"}`]} htmlFor={`genre-${lang}`} error={errorOf(`name_${lang}`)} required>
                <Input id={`genre-${lang}`} lang={lang} value={editing.values[`name_${lang}`]} onChange={(event) => setEditing({ ...editing, values: { ...editing.values, [`name_${lang}`]: event.target.value } })} required />
              </Field>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>{t.common.cancel}</Button>
              <Button type="submit" loading={pending}>{t.common.save}</Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

// ---------- Баннеры --------------------------------------------------------

type BannerValues = { [K in keyof BannerInput]: K extends "is_active" ? boolean : string };

const emptyBanner: BannerValues = {
  anime_slug: "", title_ru: "", title_en: "", title_ja: "", subtitle_ru: "", subtitle_en: "", subtitle_ja: "",
  image_url: "", link_url: "", sort_order: "0", is_active: true, starts_at: "", ends_at: "",
};

function toLocalInput(value: string | null): string {
  return value ? value.slice(0, 16) : "";
}

export function BannersManager({ banners }: { banners: AdminBanner[] }) {
  const a = useAdminI18n();
  const { t, locale } = useI18n();
  const { run, pending, errorOf } = useRun();
  const [editing, setEditing] = useState<{ id: string | null; values: BannerValues } | null>(null);
  const set = (patch: Partial<BannerValues>) => setEditing((current) => (current ? { ...current, values: { ...current.values, ...patch } } : current));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (await run(() => saveBannerAction(editing.id, editing.values), { success: a.banners.saved })) setEditing(null);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ id: null, values: emptyBanner })}>
          <Plus className="size-4" aria-hidden />
          {a.banners.add}
        </Button>
      </div>
      {banners.length === 0 ? <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-sm text-muted">{a.common.noData}</p> : null}
      <ul className="grid gap-4 lg:grid-cols-2">
        {banners.map((banner) => {
          const image = banner.image_url ?? banner.anime?.banner_url ?? banner.anime?.poster_url;
          return (
            <li key={banner.id} className="overflow-hidden rounded-2xl border border-line bg-surface/80">
              <div className="relative aspect-[16/6] bg-elevated">
                {image ? <Image src={image} alt="" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-night/90 to-transparent" />
                <p className="absolute inset-x-4 bottom-3 line-clamp-1 font-display font-semibold">{banner.title_ru || banner.anime?.title_romaji || a.banners.custom}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 p-3">
                <Badge tone={banner.is_active ? "success" : "neutral"}>{banner.is_active ? a.common.active : a.common.inactive}</Badge>
                <Badge>#{banner.sort_order}</Badge>
                {banner.anime ? <Badge tone="sky">/{banner.anime.slug}</Badge> : null}
                {banner.ends_at ? <span className="text-xs text-dim">→ {formatDate(locale, banner.ends_at)}</span> : null}
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t.common.edit}
                    onClick={() =>
                      setEditing({
                        id: banner.id,
                        values: {
                          anime_slug: banner.anime?.slug ?? "",
                          title_ru: banner.title_ru ?? "", title_en: banner.title_en ?? "", title_ja: banner.title_ja ?? "",
                          subtitle_ru: banner.subtitle_ru ?? "", subtitle_en: banner.subtitle_en ?? "", subtitle_ja: banner.subtitle_ja ?? "",
                          image_url: banner.image_url ?? "", link_url: banner.link_url ?? "", sort_order: String(banner.sort_order),
                          is_active: banner.is_active, starts_at: toLocalInput(banner.starts_at), ends_at: toLocalInput(banner.ends_at),
                        },
                      })
                    }
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <ConfirmButton variant="ghost" title={a.common.confirmDelete} description={a.common.confirmDeleteText} confirmLabel={t.common.delete} aria-label={t.common.delete} onConfirm={async () => { await run(() => deleteBannerAction(banner.id), { success: a.banners.deleted }); }}>
                    <Trash2 className="size-4" aria-hidden />
                  </ConfirmButton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {editing ? (
        <Dialog open onClose={() => setEditing(null)} title={editing.id ? t.common.edit : a.banners.add} className="w-[min(92vw,44rem)]">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label={a.banners.anime} htmlFor="banner-anime" hint={a.banners.animeHint} error={errorOf("anime_slug") ? a.banners.animeNotFound : null} className="sm:col-span-2">
              <Input id="banner-anime" value={editing.values.anime_slug} onChange={(event) => set({ anime_slug: event.target.value })} placeholder="one-piece" />
            </Field>
            {LANGS.map((lang) => (
              <Field key={`t-${lang}`} label={a.banners[`title${lang === "ru" ? "Ru" : lang === "en" ? "En" : "Ja"}`]} htmlFor={`banner-title-${lang}`} error={errorOf(`title_${lang}`)} className={lang === "ru" ? "sm:col-span-2" : undefined}>
                <Input id={`banner-title-${lang}`} lang={lang} value={editing.values[`title_${lang}`]} onChange={(event) => set({ [`title_${lang}`]: event.target.value })} />
              </Field>
            ))}
            {LANGS.map((lang) => (
              <Field key={`s-${lang}`} label={a.banners[`subtitle${lang === "ru" ? "Ru" : lang === "en" ? "En" : "Ja"}`]} htmlFor={`banner-subtitle-${lang}`} className={lang === "ru" ? "sm:col-span-2" : undefined}>
                <Textarea id={`banner-subtitle-${lang}`} lang={lang} rows={2} value={editing.values[`subtitle_${lang}`]} onChange={(event) => set({ [`subtitle_${lang}`]: event.target.value })} />
              </Field>
            ))}
            <div className="sm:col-span-2">
              <ImageField id="banner-image" kind="banner" label={a.banners.image} hint={a.anime.bannerHint} value={editing.values.image_url} onChange={(url) => set({ image_url: url })} error={errorOf("image_url")} />
            </div>
            <Field label={a.banners.link} htmlFor="banner-link" error={errorOf("link_url")}>
              <Input id="banner-link" value={editing.values.link_url} onChange={(event) => set({ link_url: event.target.value })} placeholder="/catalog" />
            </Field>
            <Field label={a.banners.order} htmlFor="banner-order" error={errorOf("sort_order")}>
              <Input id="banner-order" type="number" min={0} max={1000} value={editing.values.sort_order} onChange={(event) => set({ sort_order: event.target.value })} />
            </Field>
            <Field label={a.banners.startsAt} htmlFor="banner-starts">
              <Input id="banner-starts" type="datetime-local" value={editing.values.starts_at} onChange={(event) => set({ starts_at: event.target.value })} />
            </Field>
            <Field label={a.banners.endsAt} htmlFor="banner-ends" error={errorOf("ends_at")}>
              <Input id="banner-ends" type="datetime-local" value={editing.values.ends_at} onChange={(event) => set({ ends_at: event.target.value })} />
            </Field>
            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox checked={editing.values.is_active} onChange={(event) => set({ is_active: event.target.checked })} />
              {a.banners.isActive}
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>{t.common.cancel}</Button>
              <Button type="submit" loading={pending}>{t.common.save}</Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

// ---------- Новости --------------------------------------------------------

type NewsValues = { [K in keyof NewsInput]: K extends "is_published" ? boolean : string };

export function NewsForm({ id, initial }: { id: string | null; initial: NewsValues }) {
  const a = useAdminI18n();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { run, pending, errorOf } = useRun();
  const [values, setValues] = useState(initial);
  const set = (patch: Partial<NewsValues>) => setValues((current) => ({ ...current, ...patch }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(() => saveNewsAction(id, values), {
      success: a.news.saved,
      onSuccess: (data) => {
        if (!id) router.replace(localizePath(locale, `/admin/news/${data.id}`));
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card className="grid gap-4 md:grid-cols-2">
        <Field label={a.news.titleRu} htmlFor="news-title-ru" error={errorOf("title_ru")} required>
          <Input id="news-title-ru" lang="ru" value={values.title_ru} onChange={(event) => set({ title_ru: event.target.value })} required />
        </Field>
        <Field label={a.news.slug} htmlFor="news-slug" error={errorOf("slug")} hint={a.anime.slugHint}>
          <Input id="news-slug" value={values.slug} onChange={(event) => set({ slug: event.target.value })} />
        </Field>
        <Field label={a.news.bodyRu} htmlFor="news-body-ru" error={errorOf("body_ru")} required className="md:col-span-2">
          <Textarea id="news-body-ru" lang="ru" rows={8} value={values.body_ru} onChange={(event) => set({ body_ru: event.target.value })} required />
        </Field>
        <Field label={a.news.titleEn} htmlFor="news-title-en">
          <Input id="news-title-en" lang="en" value={values.title_en} onChange={(event) => set({ title_en: event.target.value })} />
        </Field>
        <Field label={a.news.titleJa} htmlFor="news-title-ja">
          <Input id="news-title-ja" lang="ja" value={values.title_ja} onChange={(event) => set({ title_ja: event.target.value })} />
        </Field>
        <Field label={a.news.bodyEn} htmlFor="news-body-en">
          <Textarea id="news-body-en" lang="en" rows={6} value={values.body_en} onChange={(event) => set({ body_en: event.target.value })} />
        </Field>
        <Field label={a.news.bodyJa} htmlFor="news-body-ja">
          <Textarea id="news-body-ja" lang="ja" rows={6} value={values.body_ja} onChange={(event) => set({ body_ja: event.target.value })} />
        </Field>
        <div className="md:col-span-2">
          <ImageField id="news-cover" kind="banner" label={a.news.cover} hint={a.anime.bannerHint} value={values.cover_url} onChange={(url) => set({ cover_url: url })} error={errorOf("cover_url")} />
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <Checkbox checked={values.is_published} onChange={(event) => set({ is_published: event.target.checked })} />
          {a.news.isPublished}
        </label>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
        {id ? (
          <ConfirmButton
            className="ml-auto"
            title={a.common.confirmDelete}
            description={a.common.confirmDeleteText}
            confirmLabel={t.common.delete}
            onConfirm={async () => {
              await run(() => deleteNewsAction(id), { success: a.news.deleted, refresh: false, onSuccess: () => router.replace(localizePath(locale, "/admin/news")) });
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

// ---------- Настройки ------------------------------------------------------

type SettingsValues = Omit<SettingsInput, "anilist_sync_batch"> & { anilist_sync_batch: string };

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const a = useAdminI18n();
  const { t } = useI18n();
  const { run, pending, errorOf } = useRun();
  const [values, setValues] = useState(initial);
  const set = (patch: Partial<SettingsValues>) => setValues((current) => ({ ...current, ...patch }));

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void run(() => saveSettingsAction(values), { success: a.settings.saved });
      }}
      className="space-y-6"
    >
      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold">{a.settings.general}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={a.settings.siteName} htmlFor="set-site-name" error={errorOf("site_name")} required>
            <Input id="set-site-name" value={values.site_name} onChange={(event) => set({ site_name: event.target.value })} required />
          </Field>
          <Field label={a.settings.contactEmail} htmlFor="set-contact" error={errorOf("contact_email")}>
            <Input id="set-contact" type="email" value={values.contact_email} onChange={(event) => set({ contact_email: event.target.value })} />
          </Field>
        </div>
        <div className="mt-5 space-y-4">
          <Switch id="set-registration" label={a.settings.registrationEnabled} checked={values.registration_enabled} onChange={(registration_enabled) => set({ registration_enabled })} />
          <Switch id="set-maintenance" label={a.settings.maintenanceMode} description={a.settings.maintenanceHint} checked={values.maintenance_mode} onChange={(maintenance_mode) => set({ maintenance_mode })} />
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold">{a.settings.anilist}</h2>
        <div className="space-y-4">
          <Switch id="set-autosync" label={a.settings.autoSync} checked={values.anilist_auto_sync} onChange={(anilist_auto_sync) => set({ anilist_auto_sync })} />
          <Field label={a.settings.syncBatch} htmlFor="set-batch" error={errorOf("anilist_sync_batch")} className="max-w-xs">
            <Input id="set-batch" type="number" min={1} max={50} value={values.anilist_sync_batch} onChange={(event) => set({ anilist_sync_batch: event.target.value })} />
          </Field>
        </div>
      </Card>
      <Button type="submit" loading={pending}>
        {pending ? t.common.saving : t.common.save}
      </Button>
    </form>
  );
}

// ---------- Тарифы ---------------------------------------------------------

type PlanValues = Omit<PlanInput, "price_cents"> & { price_cents: string };

export function PlanForm({ plan }: { plan: PlanValues }) {
  const a = useAdminI18n();
  const { t } = useI18n();
  const { run, pending, errorOf } = useRun();
  const [values, setValues] = useState(plan);
  const set = (patch: Partial<PlanValues>) => setValues((current) => ({ ...current, ...patch }));

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void run(() => savePlanAction(values), { success: a.subscriptions.planSaved });
      }}
      className="grid gap-3 rounded-xl border border-line bg-white/[0.03] p-4 sm:grid-cols-3"
    >
      <p className="sm:col-span-3">
        <code className="text-xs text-brand-soft">{values.id}</code>
      </p>
      {LANGS.map((lang) => (
        <Field key={lang} label={a.common[lang]} htmlFor={`plan-${values.id}-${lang}`} error={errorOf(`name_${lang}`)}>
          <Input id={`plan-${values.id}-${lang}`} lang={lang} value={values[`name_${lang}`]} onChange={(event) => set({ [`name_${lang}`]: event.target.value })} required />
        </Field>
      ))}
      <Field label={a.subscriptions.price} htmlFor={`plan-${values.id}-price`} error={errorOf("price_cents")}>
        <Input id={`plan-${values.id}-price`} type="number" min={0} value={values.price_cents} onChange={(event) => set({ price_cents: event.target.value })} required />
      </Field>
      <Field label={a.subscriptions.currency} htmlFor={`plan-${values.id}-currency`} error={errorOf("currency")}>
        <Input id={`plan-${values.id}-currency`} maxLength={3} value={values.currency} onChange={(event) => set({ currency: event.target.value })} required />
      </Field>
      <div className="flex items-end justify-between gap-3">
        <label className="flex items-center gap-2.5 pb-3 text-sm">
          <Checkbox checked={values.is_active} onChange={(event) => set({ is_active: event.target.checked })} />
          {a.common.active}
        </label>
        <Button type="submit" variant="secondary" loading={pending}>
          {t.common.save}
        </Button>
      </div>
    </form>
  );
}

import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { AnimeForm } from "@/components/admin/anime-form";
import { EpisodesManager } from "@/components/admin/episodes-manager";
import { AdminHeader } from "@/components/admin/ui";
import { Link } from "@/components/ui/link";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { getLocale } from "@/i18n/server";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { getAdminAnime, getAdminGenres } from "@/lib/data/admin";
import { localizedField } from "@/lib/data/localize";
import { uuidSchema } from "@/lib/validation/admin";

export default async function AdminAnimeEditPage({ params }: PageProps<"/[lang]/admin/anime/[id]">) {
  const [locale, { id }] = await Promise.all([getLocale(), params]);
  const a = await getAdminDictionary(locale);
  const user = await requirePermission(locale, "content.manage");
  if (!uuidSchema.safeParse(id).success) notFound();
  const [anime, genres] = await Promise.all([getAdminAnime(id), getAdminGenres()]);
  if (!anime) notFound();
  const translation = (lang: string) => anime.anime_translations.find((row) => row.locale === lang);

  return (
    <>
      <Link href="/admin/anime" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-soft hover:underline">
        <ChevronLeft className="size-4" aria-hidden />
        {a.anime.title}
      </Link>
      <AdminHeader title={anime.title_romaji} description={`/${anime.slug}`} />
      <div className="space-y-6">
        <AnimeForm
          key={anime.updated_at}
          id={anime.id}
          genres={genres.map((genre) => ({ id: genre.id, name: localizedField(locale, { ru: genre.name_ru, en: genre.name_en, ja: genre.name_ja }) }))}
          meta={{
            anilistId: anime.anilist_id,
            syncedAt: anime.anilist_synced_at,
            lockedFields: anime.locked_fields,
            canDelete: can(user.role, "content.delete"),
            publishedSlug: anime.is_published ? anime.slug : null,
          }}
          initial={{
            slug: anime.slug,
            title_romaji: anime.title_romaji,
            title_english: anime.title_english ?? "",
            title_native: anime.title_native ?? "",
            title_ru: translation("ru")?.title ?? "",
            description_ru: translation("ru")?.description ?? "",
            description_en: translation("en")?.description ?? anime.description ?? "",
            description_ja: translation("ja")?.description ?? "",
            synonyms: anime.synonyms.join("\n"),
            format: anime.format,
            status: anime.status,
            season: anime.season ?? "",
            season_year: anime.season_year ?? "",
            start_date: anime.start_date ?? "",
            end_date: anime.end_date ?? "",
            episodes_total: anime.episodes_total ?? "",
            episode_duration: anime.episode_duration ?? "",
            score: anime.score ?? "",
            studio: anime.studio ?? "",
            source: anime.source ?? "",
            trailer_youtube_id: anime.trailer_youtube_id ?? "",
            poster_url: anime.poster_url ?? "",
            banner_url: anime.banner_url ?? "",
            genre_ids: anime.anime_genres.map((row) => row.genre_id),
            is_published: anime.is_published,
            is_featured: anime.is_featured,
            is_adult: anime.is_adult,
          }}
        />
        <EpisodesManager animeId={anime.id} seasons={anime.seasons} />
      </div>
    </>
  );
}

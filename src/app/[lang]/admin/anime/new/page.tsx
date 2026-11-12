import { AnimeForm } from "@/components/admin/anime-form";
import { AdminHeader } from "@/components/admin/ui";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { getLocale } from "@/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getAdminGenres } from "@/lib/data/admin";
import { localizedField } from "@/lib/data/localize";

export default async function AdminAnimeNewPage() {
  const locale = await getLocale();
  const a = await getAdminDictionary(locale);
  await requirePermission(locale, "content.manage");
  const genres = await getAdminGenres();
  return (
    <>
      <AdminHeader title={a.anime.new} />
      <AnimeForm
        id={null}
        genres={genres.map((genre) => ({ id: genre.id, name: localizedField(locale, { ru: genre.name_ru, en: genre.name_en, ja: genre.name_ja }) }))}
        initial={{
          slug: "", title_romaji: "", title_english: "", title_native: "", title_ru: "",
          description_ru: "", description_en: "", description_ja: "", synonyms: "",
          format: "tv", status: "announced", season: "", season_year: "", start_date: "", end_date: "",
          episodes_total: "", episode_duration: "", score: "", studio: "", source: "", trailer_youtube_id: "",
          poster_url: "", banner_url: "", genre_ids: [], is_published: false, is_featured: false, is_adult: false,
        }}
      />
    </>
  );
}

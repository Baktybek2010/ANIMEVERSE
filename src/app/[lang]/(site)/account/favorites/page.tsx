import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { UserListContent } from "@/components/account/list-page";
import { AnimeGridSkeleton } from "@/components/anime/anime-card";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.favorites.title };
}

export default function Page({ searchParams }: PageProps<"/[lang]/account/favorites">) {
  return (
    <Suspense fallback={<AnimeGridSkeleton count={12} />}>
      <UserListContent table="favorites" path="/account/favorites" icon={Heart} searchParams={searchParams} />
    </Suspense>
  );
}

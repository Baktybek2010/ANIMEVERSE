import { Bookmark } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { UserListContent } from "@/components/account/list-page";
import { AnimeGridSkeleton } from "@/components/anime/anime-card";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.watchlist.title };
}

export default function Page({ searchParams }: PageProps<"/[lang]/account/watchlist">) {
  return (
    <Suspense fallback={<AnimeGridSkeleton count={12} />}>
      <UserListContent table="watchlist" path="/account/watchlist" icon={Bookmark} searchParams={searchParams} />
    </Suspense>
  );
}

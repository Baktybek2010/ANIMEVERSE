import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/components/ui/link";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDate } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getNews } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return pageMetadata({ locale, path: "/news", title: t.meta.newsTitle, description: t.news.description });
}

export default async function NewsPage() {
  const { locale, t } = await getI18n();
  const news = await getNews(locale, 60);
  return (
    <div className="container-page py-8 sm:py-10">
      <PageHeader title={t.news.title} description={t.news.description} />
      <div className="mt-8">
        {news.length === 0 ? (
          <EmptyState icon={Newspaper} title={t.news.emptyTitle} text={t.news.emptyText} />
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {news.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/news/${item.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface/80 transition-[border-color,box-shadow] duration-300 hover:border-brand/50 hover:shadow-glow"
                >
                  <div className="relative aspect-[16/8] bg-elevated">
                    {item.coverUrl ? (
                      <Image src={item.coverUrl} alt="" fill sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw" className="object-cover" />
                    ) : (
                      <div className="bg-brand-gradient grid h-full place-items-center opacity-70">
                        <Newspaper className="size-10 text-white/80" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    {item.publishedAt ? <time dateTime={item.publishedAt} className="text-xs text-dim">{formatDate(locale, item.publishedAt)}</time> : null}
                    <h2 className="mt-1.5 line-clamp-2 text-lg font-semibold transition-colors group-hover:text-brand-soft">{item.title}</h2>
                    <p className="mt-2 line-clamp-3 text-sm text-muted">{item.body}</p>
                    <span className="mt-4 text-sm font-medium text-brand-soft">{t.news.readMore} →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

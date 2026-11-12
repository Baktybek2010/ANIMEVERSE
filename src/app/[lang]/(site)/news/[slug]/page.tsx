import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/misc";
import { formatDate } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getNewsBySlug } from "@/lib/data/catalog";
import { absoluteUrl, jsonLd, pageMetadata } from "@/lib/seo";
import { SLUG_PATTERN } from "@/lib/slug";

type Props = PageProps<"/[lang]/news/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ locale, t }, { slug }] = await Promise.all([getI18n(), params]);
  const item = SLUG_PATTERN.test(slug) ? await getNewsBySlug(slug, locale) : null;
  if (!item) return { title: t.pages.notFoundTitle, robots: { index: false } };
  return pageMetadata({
    locale,
    path: `/news/${item.slug}`,
    title: item.title,
    description: item.body.slice(0, 180),
    image: item.coverUrl,
    type: "article",
  });
}

async function Article({ params }: Pick<Props, "params">) {
  const [{ locale, t }, { slug }] = await Promise.all([getI18n(), params]);
  if (!SLUG_PATTERN.test(slug)) notFound();
  const item = await getNewsBySlug(slug, locale);
  if (!item) notFound();
  const paragraphs = item.body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <article className="mx-auto max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: item.title,
            datePublished: item.publishedAt ?? undefined,
            image: item.coverUrl ?? undefined,
            url: absoluteUrl(`/${locale}/news/${item.slug}`),
            publisher: { "@type": "Organization", name: "ANIMEVERSE" },
          }),
        }}
      />
      <Link href="/news" className="inline-flex items-center gap-1 text-sm text-brand-soft hover:underline">
        <ChevronLeft className="size-4" aria-hidden />
        {t.news.backToNews}
      </Link>
      {item.publishedAt ? <time dateTime={item.publishedAt} className="mt-5 block text-sm text-dim">{formatDate(locale, item.publishedAt)}</time> : null}
      <h1 className="mt-2 font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{item.title}</h1>
      {item.coverUrl ? (
        <div className="relative mt-6 aspect-[16/8] overflow-hidden rounded-2xl bg-elevated">
          <Image src={item.coverUrl} alt="" fill priority sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
        </div>
      ) : null}
      {item.isFallback ? <p className="mt-6 rounded-xl border border-line bg-white/5 px-4 py-2.5 text-sm text-muted">{t.news.translationMissing}</p> : null}
      <div className="mt-6 space-y-4 text-base leading-relaxed text-fg/90">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}

export default function NewsArticlePage({ params }: Props) {
  return (
    <div className="container-page py-8 sm:py-12">
      <Suspense
        fallback={
          <div className="mx-auto max-w-3xl" aria-hidden>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-6 h-10 w-4/5" />
            <Skeleton className="mt-6 aspect-[16/8] w-full rounded-2xl" />
            <Skeleton className="mt-6 h-40 w-full" />
          </div>
        }
      >
        <Article params={params} />
      </Suspense>
    </div>
  );
}

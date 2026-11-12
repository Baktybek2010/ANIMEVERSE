import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import "../globals.css";
import { FlashNotice } from "@/components/layout/flash-notice";
import { ServiceWorker } from "@/components/layout/service-worker";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/i18n/client";
import { hasLocale, locales, localeTags, ogLocales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSiteUrl } from "@/lib/env";
import { buildAlternates } from "@/lib/seo";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = await getDictionary(lang);
  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: t.meta.homeTitle, template: t.meta.titleTemplate },
    description: t.meta.homeDescription,
    applicationName: "ANIMEVERSE",
    alternates: buildAlternates(lang, "/"),
    openGraph: {
      type: "website",
      siteName: "ANIMEVERSE",
      locale: ogLocales[lang],
      title: t.meta.homeTitle,
      description: t.meta.homeDescription,
    },
    twitter: { card: "summary_large_image" },
    appleWebApp: { capable: true, title: "ANIMEVERSE", statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#07060e",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dictionary = await getDictionary(lang);

  return (
    <html lang={localeTags[lang]} className="h-full">
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={lang} dictionary={dictionary}>
          <ToastProvider>
            {children}
            <Suspense fallback={null}>
              <FlashNotice />
            </Suspense>
          </ToastProvider>
        </I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}

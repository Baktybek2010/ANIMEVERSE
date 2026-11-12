import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { RedirectIfAuthenticated } from "@/components/auth/guards";
import { LoginForm } from "@/components/auth/login-form";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { isSupabaseConfigured } from "@/lib/env";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return pageMetadata({ locale, path: "/login", title: t.meta.loginTitle, noIndex: true });
}

export default async function LoginPage() {
  const { t } = await getI18n();
  return (
    <AuthShell
      title={t.auth.loginTitle}
      subtitle={t.auth.loginSubtitle}
      footer={
        <>
          {t.auth.noAccount}{" "}
          <Link href="/register" className="font-medium text-brand-soft hover:underline">
            {t.auth.signUp}
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <RedirectIfAuthenticated />
      </Suspense>
      {isSupabaseConfigured ? (
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <LoginForm />
        </Suspense>
      ) : (
        <div role="alert" className="rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm">
          <p className="font-semibold text-gold">{t.auth.notConfiguredTitle}</p>
          <p className="mt-1 text-muted">{t.auth.notConfiguredText}</p>
        </div>
      )}
    </AuthShell>
  );
}

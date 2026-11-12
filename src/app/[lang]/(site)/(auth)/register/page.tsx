import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell, FormAlert } from "@/components/auth/auth-shell";
import { RedirectIfAuthenticated } from "@/components/auth/guards";
import { RegisterForm } from "@/components/auth/register-form";
import { Link } from "@/components/ui/link";
import { getI18n } from "@/i18n/server";
import { getPublicSettings } from "@/lib/data/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return pageMetadata({ locale, path: "/register", title: t.meta.registerTitle, noIndex: true });
}

export default async function RegisterPage() {
  const [{ t }, settings] = await Promise.all([getI18n(), getPublicSettings()]);
  return (
    <AuthShell
      title={t.auth.registerTitle}
      subtitle={t.auth.registerSubtitle}
      footer={
        <>
          {t.auth.haveAccount}{" "}
          <Link href="/login" className="font-medium text-brand-soft hover:underline">
            {t.auth.signIn}
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <RedirectIfAuthenticated />
      </Suspense>
      {!isSupabaseConfigured ? (
        <div role="alert" className="rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm">
          <p className="font-semibold text-gold">{t.auth.notConfiguredTitle}</p>
          <p className="mt-1 text-muted">{t.auth.notConfiguredText}</p>
        </div>
      ) : settings.registrationEnabled ? (
        <RegisterForm />
      ) : (
        <FormAlert>{t.auth.registrationDisabled}</FormAlert>
      )}
    </AuthShell>
  );
}

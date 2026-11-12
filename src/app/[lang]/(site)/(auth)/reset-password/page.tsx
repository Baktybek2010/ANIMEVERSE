import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell, FormAlert } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { ButtonLink } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return pageMetadata({ locale, path: "/reset-password", title: t.auth.resetTitle, noIndex: true });
}

/** Форма доступна только с сессией, созданной переходом по ссылке из письма. */
async function ResetGate() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert>{t.auth.resetLinkInvalid}</FormAlert>
        <ButtonLink href="/forgot-password" className="w-full">
          {t.auth.sendResetLink}
        </ButtonLink>
      </div>
    );
  }
  return <ResetPasswordForm />;
}

export default async function ResetPasswordPage() {
  const { t } = await getI18n();
  return (
    <AuthShell title={t.auth.resetTitle} subtitle={t.auth.resetText}>
      <Suspense fallback={<Skeleton className="h-52 w-full rounded-xl" />}>
        <ResetGate />
      </Suspense>
    </AuthShell>
  );
}

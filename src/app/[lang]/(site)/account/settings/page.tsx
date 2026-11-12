import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm, DeleteAccount, PreferencesForm } from "@/components/account/settings-forms";
import { Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.settings.title };
}

async function Content() {
  const { locale, t } = await getI18n();
  const user = await requireUser(locale, `/${locale}/account/settings`);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t.account.settings.title}</h1>
      <PreferencesForm
        isPremium={user.isPremium}
        initial={{
          autoplayNext: user.preferences.autoplayNext ?? true,
          audioLang: user.preferences.audioLang ?? "",
          subtitleLang: user.preferences.subtitleLang ?? "",
          quality: user.preferences.quality ?? "auto",
          emailNotifications: user.preferences.emailNotifications ?? true,
        }}
      />
      <ChangePasswordForm />
      <DeleteAccount username={user.username} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-2xl" />}>
      <Content />
    </Suspense>
  );
}

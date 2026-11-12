import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileForm } from "@/components/account/profile-form";
import { Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.profile.title };
}

async function Content() {
  const { locale, t } = await getI18n();
  const user = await requireUser(locale, `/${locale}/account`);
  return (
    <ProfileForm
      profile={{
        displayName: user.displayName,
        username: user.username,
        bio: user.bio ?? "",
        avatarUrl: user.avatarUrl,
        email: user.email,
        roleLabel: t.roles[user.role],
      }}
    />
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <Content />
    </Suspense>
  );
}

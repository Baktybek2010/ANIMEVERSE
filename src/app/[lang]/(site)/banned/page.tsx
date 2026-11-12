import { ShieldBan } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/misc";
import { localizePath } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { logoutAction } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return pageMetadata({ locale, path: "/banned", title: t.auth.bannedTitle, noIndex: true });
}

async function BannedContent() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user || !user.isBanned) redirect(localizePath(locale, "/"));
  return (
    <ErrorState
      icon={ShieldBan}
      title={t.auth.bannedTitle}
      text={[t.auth.bannedText, user.bannedReason ? fmt(t.auth.bannedReason, { reason: user.bannedReason }) : ""].filter(Boolean).join(" ")}
      action={
        <form action={logoutAction.bind(null, locale)}>
          <Button type="submit" variant="secondary">
            {t.nav.logout}
          </Button>
        </form>
      }
    />
  );
}

export default function BannedPage() {
  return (
    <div className="container-page py-20">
      <Suspense fallback={null}>
        <BannedContent />
      </Suspense>
    </div>
  );
}

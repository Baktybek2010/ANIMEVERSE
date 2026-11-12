"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";

/** Одноразовые уведомления после редиректов: ?notice=<ключ>. */
export function FlashNotice() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const notice = searchParams.get("notice");

  useEffect(() => {
    if (!notice) return;
    const messages: Record<string, { kind: "success" | "error" | "info"; text: string }> = {
      loggedOut: { kind: "info", text: t.auth.loggedOut },
      emailConfirmed: { kind: "success", text: t.auth.emailConfirmed },
      emailConfirmedLogin: { kind: "success", text: t.auth.emailConfirmedLogin },
      confirmFailed: { kind: "error", text: t.auth.confirmFailed },
      resetLinkInvalid: { kind: "error", text: t.auth.resetLinkInvalid },
      passwordUpdated: { kind: "success", text: t.auth.passwordUpdated },
      accountDeleted: { kind: "info", text: t.account.settings.accountDeleted },
      checkoutCanceled: { kind: "info", text: t.premium.canceledNotice },
    };
    const message = messages[notice];
    if (message) toast[message.kind](message.text);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("notice");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [notice, pathname, router, searchParams, t, toast]);

  return null;
}

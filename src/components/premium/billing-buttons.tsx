"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createCheckoutAction, createPortalAction } from "@/lib/actions/billing";

/** Переход к оплате выбранного тарифа на странице платёжного провайдера. */
export function CheckoutButton({ planId, children, variant = "primary", className }: { planId: string; children: ReactNode; variant?: ButtonVariant; className?: string }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={variant}
      size="lg"
      className={className}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createCheckoutAction(planId, locale);
          if (!result.ok) {
            toast.error(t.errors[result.error]);
            return;
          }
          window.location.assign(result.data.url);
        })
      }
    >
      {pending ? t.premium.redirecting : children}
    </Button>
  );
}

export function PortalButton({ children, size = "md" }: { children: ReactNode; size?: ButtonSize }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size={size}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createPortalAction(locale);
          if (!result.ok) {
            toast.error(t.errors[result.error]);
            return;
          }
          window.location.assign(result.data.url);
        })
      }
    >
      {children}
    </Button>
  );
}

export function RefreshButton({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="secondary" loading={pending} onClick={() => startTransition(() => router.refresh())}>
      {children}
    </Button>
  );
}

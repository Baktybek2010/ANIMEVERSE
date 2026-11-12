"use client";

import { Check, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type Locale, localeNames, locales, localizePath, splitLocale } from "@/i18n/config";
import { persistLocale } from "@/i18n/persist";
import { useI18n } from "@/i18n/client";
import { Dropdown, menuItemClass } from "@/components/ui/dropdown";
import { saveLocaleAction } from "@/lib/actions/profile";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    persistLocale(next);
    const { path } = splitLocale(window.location.pathname);
    const target = `${localizePath(next, path)}${window.location.search}${window.location.hash}`;
    startTransition(async () => {
      // Для авторизованных язык дополнительно сохраняется в профиле.
      await saveLocaleAction(next).catch(() => undefined);
      router.push(target);
    });
  };

  return (
    <Dropdown
      label={`${t.nav.language}: ${localeNames[locale]}`}
      triggerClassName={cn(
        "flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/8 hover:text-fg",
        pending && "opacity-60",
        className,
      )}
      trigger={
        <>
          <Globe className="size-4.5" aria-hidden />
          <span className="uppercase">{locale}</span>
        </>
      }
      className="min-w-44"
    >
      {(close) =>
        locales.map((item) => (
          <button
            key={item}
            type="button"
            role="menuitemradio"
            aria-checked={item === locale}
            lang={item}
            onClick={() => {
              close();
              switchTo(item);
            }}
            className={menuItemClass}
          >
            <span className="flex-1">{localeNames[item]}</span>
            {item === locale ? <Check className="size-4 text-brand-soft" aria-hidden /> : null}
          </button>
        ))
      }
    </Dropdown>
  );
}

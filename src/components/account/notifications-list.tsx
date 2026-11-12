"use client";

import { Bell, Check, CreditCard, Crown, Megaphone, PlayCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDateTime } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { useToast } from "@/components/ui/toast";
import { deleteNotificationAction, markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/library";
import type { NotificationItem } from "@/lib/data/library";
import { cn } from "@/lib/utils";

const ICONS = {
  welcome: Sparkles,
  new_episode: PlayCircle,
  premium_activated: Crown,
  premium_granted: Crown,
  premium_expired: Crown,
  premium_canceled: Crown,
  payment_failed: CreditCard,
  role_changed: ShieldCheck,
  announcement: Megaphone,
} as const;

export function NotificationsList({ items }: { items: NotificationItem[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const unread = items.filter((item) => !item.read_at).length;

  const run = (action: () => Promise<{ ok: boolean; error?: keyof typeof t.errors }>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok && result.error) toast.error(t.errors[result.error]);
      router.refresh();
    });

  const text = (item: NotificationItem) => {
    const known = item.type in t.account.notifications.types ? t.account.notifications.types[item.type as keyof typeof ICONS] : null;
    const params: Record<string, string | number> = {
      ...item.data,
      anime: item.data.anime_title ?? "",
      role: typeof item.data.role === "string" && item.data.role in t.roles ? t.roles[item.data.role as keyof typeof t.roles] : "",
    };
    return {
      title: item.title || (known ? fmt(known.title, params) : item.type),
      body: item.body || (known ? fmt(known.body, params) : ""),
    };
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{t.account.notifications.title}</h1>
        {unread > 0 ? (
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(markAllNotificationsReadAction)}>
            <Check className="size-4" aria-hidden />
            {t.account.notifications.markAllRead}
          </Button>
        ) : null}
      </div>
      <ul className="space-y-2.5">
        {items.map((item) => {
          const Icon = ICONS[item.type as keyof typeof ICONS] ?? Bell;
          const { title, body } = text(item);
          const content = (
            <>
              <p className={cn("text-sm", item.read_at ? "font-medium text-fg/85" : "font-semibold")}>{title}</p>
              {body ? <p className="mt-0.5 text-sm text-muted">{body}</p> : null}
              <time dateTime={item.created_at} className="mt-1 block text-xs text-dim">
                {formatDateTime(locale, item.created_at)}
              </time>
            </>
          );
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-start gap-3.5 rounded-2xl border p-4",
                item.read_at ? "border-line bg-surface/50" : "border-brand/40 bg-brand/10",
              )}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", item.read_at ? "bg-white/6 text-muted" : "bg-brand/25 text-brand-soft")}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                {item.link ? (
                  <Link
                    href={item.link}
                    className="block rounded-lg hover:[&>p:first-child]:text-brand-soft"
                    onClick={() => {
                      if (!item.read_at) void markNotificationReadAction(item.id);
                    }}
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {!item.read_at ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => markNotificationReadAction(item.id))}
                    aria-label={t.account.notifications.markRead}
                    title={t.account.notifications.markRead}
                    className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/10 hover:text-fg"
                  >
                    <Check className="size-4" aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => deleteNotificationAction(item.id))}
                  aria-label={t.account.notifications.delete}
                  title={t.account.notifications.delete}
                  className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/10 hover:text-danger"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

import { SettingsForm } from "@/components/admin/content-managers";
import { AdminHeader } from "@/components/admin/ui";
import { Badge, Card } from "@/components/ui/misc";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { getLocale } from "@/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getAdminSettings } from "@/lib/data/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { isServiceRoleConfigured, isStripeConfigured, serverEnv } from "@/lib/env.server";

export default async function AdminSettingsPage() {
  const locale = await getLocale();
  const a = await getAdminDictionary(locale);
  await requirePermission(locale, "settings.manage");
  const settings = await getAdminSettings();
  // Показываем только факт наличия ключей — сами значения в интерфейс не попадают.
  const integrations = [
    { label: a.settings.supabase, ok: isSupabaseConfigured },
    { label: a.settings.serviceRole, ok: isServiceRoleConfigured() },
    { label: a.settings.stripe, ok: isStripeConfigured() },
    { label: a.settings.cron, ok: Boolean(serverEnv.cronSecret) },
  ];
  return (
    <>
      <AdminHeader title={a.settings.title} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SettingsForm initial={{ ...settings, anilist_sync_batch: String(settings.anilist_sync_batch) }} />
        <Card className="h-fit">
          <h2 className="mb-4 font-display text-lg font-semibold">{a.settings.integrations}</h2>
          <ul className="space-y-3">
            {integrations.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span>{item.label}</span>
                <Badge tone={item.ok ? "success" : "danger"}>{item.ok ? a.settings.configured : a.settings.notConfigured}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

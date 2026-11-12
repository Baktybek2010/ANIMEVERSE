import { ActivityChart } from "@/components/admin/activity-chart";
import { AdminHeader, StatCard } from "@/components/admin/ui";
import { Link } from "@/components/ui/link";
import { Avatar, Card } from "@/components/ui/misc";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { fmt, formatCompact, formatDateTime, formatMoney, formatNumber } from "@/i18n/format";
import { getLocale } from "@/i18n/server";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { getDashboard } from "@/lib/data/admin";

export default async function AdminDashboardPage() {
  const locale = await getLocale();
  const [a, user] = await Promise.all([getAdminDictionary(locale), requirePermission(locale, "admin.access")]);
  const { stats, daily, recentUsers, recentLogs } = await getDashboard();
  const n = (value: number | undefined) => formatNumber(locale, value ?? 0);

  return (
    <>
      <AdminHeader title={a.dashboard.title} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={a.dashboard.users} value={n(stats?.users_total)} hint={`${fmt(a.dashboard.newUsers, { count: n(stats?.users_new_7d) })} · ${fmt(a.dashboard.banned, { count: n(stats?.users_banned) })}`} />
        <StatCard tone="gold" label={a.dashboard.premium} value={n(stats?.premium_active)} hint={`${a.dashboard.revenue}: ${formatMoney(locale, stats?.revenue_30d_cents ?? 0, "usd")}`} />
        <StatCard tone="sky" label={a.dashboard.anime} value={n(stats?.anime_total)} hint={`${fmt(a.dashboard.animePublished, { count: n(stats?.anime_published) })} · ${a.dashboard.episodes}: ${n(stats?.episodes_total)}`} />
        <StatCard tone="success" label={a.dashboard.views} value={formatCompact(locale, stats?.views_total ?? 0)} hint={fmt(a.dashboard.views24h, { count: n(stats?.views_24h) })} />
      </div>

      <Card className="mt-6">
        <h2 className="mb-4 font-display text-lg font-semibold">{a.dashboard.activity}</h2>
        <ActivityChart data={daily} locale={locale} labels={{ views: a.dashboard.viewsSeries, signups: a.dashboard.signupsSeries, active: a.dashboard.activeSeries }} />
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold">{a.dashboard.recentUsers}</h2>
          <ul className="divide-y divide-line">
            {recentUsers.map((item) => (
              <li key={item.id}>
                <Link href={`/admin/users/${item.id}`} className="flex items-center gap-3 rounded-lg py-2.5 hover:text-brand-soft">
                  <Avatar src={item.avatar_url} name={item.display_name || item.username} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.display_name || item.username}</span>
                    <span className="block truncate text-xs text-dim">{item.email}</span>
                  </span>
                  <time dateTime={item.created_at} className="shrink-0 text-xs text-dim">
                    {formatDateTime(locale, item.created_at)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        {can(user.role, "logs.view") ? (
          <Card>
            <h2 className="mb-4 font-display text-lg font-semibold">{a.dashboard.recentEvents}</h2>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted">{a.dashboard.noEvents}</p>
            ) : (
              <ul className="divide-y divide-line">
                {recentLogs.map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <code className="rounded bg-white/8 px-1.5 py-0.5 text-xs text-brand-soft">{log.action}</code>
                      <span className="ml-2 text-muted">@{log.actor?.username ?? a.logs.system}</span>
                    </span>
                    <time dateTime={log.created_at} className="shrink-0 text-xs text-dim">
                      {formatDateTime(locale, log.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}

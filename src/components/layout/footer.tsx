import { Link } from "@/components/ui/link";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { Logo } from "./logo";

// Год в подвале фиксируется при сборке/ревалидации — без обращения к часам во время рендера.
async function currentYear(): Promise<number> {
  "use cache";
  return new Date().getFullYear();
}

export async function Footer() {
  const { t } = await getI18n();
  const year = await currentYear();

  const columns = [
    {
      title: t.footer.explore,
      links: [
        { href: "/", label: t.nav.home },
        { href: "/catalog", label: t.nav.catalog },
        { href: "/news", label: t.nav.news },
        { href: "/premium", label: t.nav.premium },
      ],
    },
    {
      title: t.footer.accountSection,
      links: [
        { href: "/account", label: t.nav.profile },
        { href: "/account/favorites", label: t.nav.favorites },
        { href: "/account/watchlist", label: t.nav.watchlist },
        { href: "/account/history", label: t.nav.history },
      ],
    },
  ];

  return (
    <footer className="mt-20 border-t border-line bg-surface/60 pb-24 md:pb-0">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">{t.footer.tagline}</p>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-dim">{t.footer.legal}</p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-semibold text-fg">{column.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted transition-colors hover:text-fg">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-dim sm:flex-row sm:items-center sm:justify-between">
          <p>{fmt(t.footer.rights, { year })}</p>
          <p>
            <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-fg">
              {t.footer.dataSource}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

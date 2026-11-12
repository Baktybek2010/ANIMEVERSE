"use client";

import { Check, CloudDownload, RefreshCw, Search } from "lucide-react";
import Image from "next/image";
import { type FormEvent, useState } from "react";
import { useAdminI18n } from "@/i18n/admin-client";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { type AniListCandidate, importAniListAction, searchAniListAction, syncAniListNowAction } from "@/lib/actions/admin/import";
import { cn } from "@/lib/utils";

type Collection = "popular" | "trending" | "season" | "top";
type Request = { query?: string; collection?: Collection; page: number };

export function ImportPanel() {
  const a = useAdminI18n();
  const { t } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [request, setRequest] = useState<Request | null>(null);
  const [items, setItems] = useState<AniListCandidate[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState<"search" | "import" | "sync" | null>(null);
  const [searched, setSearched] = useState(false);

  const showError = (error: keyof typeof t.errors) =>
    toast.error(error === "rateLimited" ? a.import.rateLimited : error === "network" ? a.import.unavailable : t.errors[error]);

  const load = async (next: Request) => {
    setBusy("search");
    try {
      const result = await searchAniListAction(next);
      if (!result.ok) {
        showError(result.error);
        return;
      }
      setRequest(next);
      setItems(result.data.items);
      setHasNext(result.data.hasNext);
      setSelected(new Set());
      setSearched(true);
    } catch {
      toast.error(a.import.unavailable);
    } finally {
      setBusy(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length >= 2) void load({ query: query.trim(), page: 1 });
  };

  const runImport = async () => {
    setBusy("import");
    try {
      const result = await importAniListAction({ ids: [...selected], publish });
      if (!result.ok) {
        showError(result.error);
        return;
      }
      toast.success(fmt(a.import.result, result.data));
      setItems((current) => current.map((item) => (selected.has(item.id) ? { ...item, inCatalog: true } : item)));
      setSelected(new Set());
    } catch {
      toast.error(a.import.unavailable);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 50) next.add(id);
      return next;
    });

  const collections: { key: Collection; label: string }[] = [
    { key: "popular", label: a.import.popular },
    { key: "trending", label: a.import.trending },
    { key: "season", label: a.import.season },
    { key: "top", label: a.import.top },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={submit} role="search" className="flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-dim" aria-hidden />
            <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={a.import.searchPlaceholder} aria-label={a.import.search} maxLength={80} className="pl-10" />
          </div>
          <Button type="submit" loading={busy === "search"} disabled={query.trim().length < 2}>
            {a.import.search}
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-dim uppercase">{a.import.collections}</span>
          {collections.map((collection) => (
            <button
              key={collection.key}
              type="button"
              disabled={busy !== null}
              onClick={() => load({ collection: collection.key, page: 1 })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50",
                request?.collection === collection.key ? "border-transparent bg-brand-gradient font-medium text-white" : "border-line text-muted hover:border-brand-soft/50 hover:text-fg",
              )}
            >
              {collection.label}
            </button>
          ))}
        </div>
      </Card>

      {items.length > 0 ? (
        <>
          <div className="glass sticky top-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line-strong p-3">
            <Button onClick={runImport} loading={busy === "import"} disabled={selected.size === 0}>
              <CloudDownload className="size-4" aria-hidden />
              {fmt(a.import.importSelected, { count: selected.size })}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(items.map((item) => item.id)))}>
              {a.import.selectAll}
            </Button>
            {selected.size > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                {a.import.clear}
              </Button>
            ) : null}
            <label className="ml-auto flex items-center gap-2.5 text-sm">
              <Checkbox checked={publish} onChange={(event) => setPublish(event.target.checked)} />
              {a.import.publish}
            </label>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const active = selected.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
                      active ? "border-brand bg-brand/15" : "border-line bg-surface/80 hover:border-brand-soft/40",
                    )}
                  >
                    <span className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-elevated">
                      {item.cover ? <Image src={item.cover} alt="" fill sizes="64px" className="object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-medium">{item.title}</span>
                      {item.titleNative ? <span lang="ja" className="mt-0.5 line-clamp-1 block text-xs text-dim">{item.titleNative}</span> : null}
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {item.year ? <Badge>{item.year}</Badge> : null}
                        {item.format ? <Badge>{item.format.replace("_", " ")}</Badge> : null}
                        {item.score ? <Badge tone="gold">★ {item.score.toFixed(1)}</Badge> : null}
                        {item.inCatalog ? <Badge tone="success">{a.import.inCatalog}</Badge> : null}
                      </span>
                    </span>
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-md border", active ? "border-transparent bg-brand text-white" : "border-line-strong")}>
                      {active ? <Check className="size-4" aria-hidden /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {request ? (
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={request.page <= 1 || busy !== null} onClick={() => load({ ...request, page: request.page - 1 })}>
                {t.common.previous}
              </Button>
              <span className="text-sm text-muted">{fmt(a.import.page, { page: request.page })}</span>
              <Button variant="secondary" size="sm" disabled={!hasNext || busy !== null} onClick={() => load({ ...request, page: request.page + 1 })}>
                {t.common.next}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center text-sm text-muted" role="status">
          {busy === "search" ? t.common.loading : searched ? a.import.empty : a.import.hint}
        </p>
      )}

      <Card>
        <h2 className="font-display text-lg font-semibold">{a.import.syncTitle}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{a.import.syncText}</p>
        <Button
          variant="secondary"
          className="mt-4"
          loading={busy === "sync"}
          onClick={async () => {
            setBusy("sync");
            try {
              const result = await syncAniListNowAction();
              if (result.ok) toast.success(fmt(a.import.syncResult, { updated: result.data.updated }));
              else showError(result.error);
            } catch {
              toast.error(a.import.unavailable);
            } finally {
              setBusy(null);
            }
          }}
        >
          <RefreshCw className="size-4" aria-hidden />
          {a.import.syncNow}
        </Button>
      </Card>
    </div>
  );
}

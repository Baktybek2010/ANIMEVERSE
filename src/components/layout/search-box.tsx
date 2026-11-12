"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { localizePath } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { Link } from "@/components/ui/link";
import type { AnimeCardData } from "@/lib/data/types";
import { cn, normalizeQuery } from "@/lib/utils";

export function SearchBox() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeCardData[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const normalized = normalizeQuery(query);

  // Подсказки с задержкой ввода и отменой устаревших запросов.
  useEffect(() => {
    if (normalized.length < 2) {
      setResults([]);
      setState("idle");
      return;
    }
    const controller = new AbortController();
    setState("loading");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}&lang=${locale}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as { items: AnimeCardData[] };
        setResults(payload.items);
        setState("done");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState("error");
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [normalized, locale]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Горячая клавиша «/» открывает поиск.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!normalized) return;
    router.push(`${localizePath(locale, "/catalog")}?q=${encodeURIComponent(normalized)}`);
    close();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t.search.label}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-xl text-sm text-muted transition-colors hover:text-fg",
          "w-10 justify-center hover:bg-white/8 lg:w-56 lg:justify-start lg:border lg:border-line lg:bg-white/5 lg:px-3 lg:hover:border-line-strong",
          open && "invisible",
        )}
      >
        <Search className="size-4.5 shrink-0" aria-hidden />
        <span className="hidden flex-1 truncate text-left lg:inline">{t.search.placeholder}</span>
        <kbd className="hidden rounded border border-line px-1.5 text-[0.7rem] text-dim lg:inline">/</kbd>
      </button>

      {open ? (
        <div className="fixed inset-x-3 top-3 z-[60] sm:absolute sm:inset-x-auto sm:top-0 sm:right-0 sm:w-[26rem]">
          <form
            role="search"
            onSubmit={submit}
            className="flex h-11 items-center gap-2 rounded-xl border border-brand/60 bg-raised px-3 shadow-glow sm:h-10"
          >
            {state === "loading" ? (
              <LoaderCircle className="size-4.5 shrink-0 animate-spin text-brand-soft" aria-hidden />
            ) : (
              <Search className="size-4.5 shrink-0 text-brand-soft" aria-hidden />
            )}
            <input
              ref={inputRef}
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search.placeholder}
              aria-label={t.search.label}
              aria-controls={listId}
              autoComplete="off"
              maxLength={80}
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-dim [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              type="button"
              onClick={close}
              aria-label={t.common.close}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-white/10 hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </button>
          </form>

          <div
            id={listId}
            className="mt-2 max-h-[70dvh] overflow-y-auto rounded-2xl border border-line-strong bg-raised/95 p-1.5 shadow-card backdrop-blur-xl"
          >
            {normalized.length < 2 ? (
              <p className="px-3 py-4 text-center text-sm text-dim">{t.search.hint}</p>
            ) : state === "error" ? (
              <p role="alert" className="px-3 py-4 text-center text-sm text-danger">
                {t.errors.network}
              </p>
            ) : state === "done" && results.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted">{t.search.noResults}</p>
            ) : (
              <ul>
                {results.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/anime/${item.slug}`}
                      onClick={close}
                      className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/8 focus-visible:bg-white/8"
                    >
                      <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-elevated">
                        {item.posterUrl ? <Image src={item.posterUrl} alt="" fill sizes="40px" className="object-cover" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-1 text-sm font-medium">{item.title}</span>
                        <span className="mt-0.5 block text-xs text-dim">
                          {[item.year, t.formats[item.format], item.score ? `★ ${item.score.toFixed(1)}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
                {state === "done" && results.length > 0 ? (
                  <li className="mt-1 border-t border-line pt-1">
                    <Link
                      href={`/catalog?q=${encodeURIComponent(normalized)}`}
                      onClick={close}
                      className="block rounded-xl px-3 py-2.5 text-sm text-brand-soft transition-colors hover:bg-white/8"
                    >
                      {fmt(t.search.allResults, { query: normalized })}
                    </Link>
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

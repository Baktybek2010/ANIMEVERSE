import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "./link";

type PaginationProps = {
  page: number;
  totalPages: number;
  /** Базовый путь без локали и готовая строка запроса без параметра page. */
  basePath: string;
  query?: Record<string, string | undefined>;
  labels: { previous: string; next: string; pageOf: string };
};

function pageHref(basePath: string, query: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function pageWindow(page: number, total: number): (number | "gap")[] {
  const pages = new Set<number>([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const value of sorted) {
    if (value - previous > 1) out.push("gap");
    out.push(value);
    previous = value;
  }
  return out;
}

export function Pagination({ page, totalPages, basePath, query = {}, labels }: PaginationProps) {
  if (totalPages <= 1) return null;
  const itemClass =
    "grid h-10 min-w-10 place-items-center rounded-xl border border-line px-3 text-sm font-medium transition-colors hover:border-brand-soft/50 hover:bg-white/5";
  return (
    <nav aria-label={labels.pageOf} className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={pageHref(basePath, query, page - 1)} className={itemClass} aria-label={labels.previous} rel="prev" prefetch>
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      ) : null}
      {pageWindow(page, totalPages).map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-dim" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={item}
            href={pageHref(basePath, query, item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(itemClass, item === page && "border-transparent bg-brand-gradient text-white hover:bg-none")}
          >
            {item}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={pageHref(basePath, query, page + 1)} className={itemClass} aria-label={labels.next} rel="next" prefetch>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}

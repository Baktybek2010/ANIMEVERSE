import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Поиск обычной GET-формой: работает и без JavaScript. */
export function SearchForm({ action, defaultValue, placeholder, label, children }: { action: string; defaultValue?: string; placeholder: string; label: string; children?: ReactNode }) {
  return (
    <form action={action} method="get" role="search" className="mb-4 flex flex-wrap gap-2">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-dim" aria-hidden />
        <Input type="search" name="q" defaultValue={defaultValue} placeholder={placeholder} aria-label={label} maxLength={80} className="pl-10" />
      </div>
      {children}
      <Button type="submit" variant="secondary">
        {label}
      </Button>
    </form>
  );
}

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-line bg-surface/80", className)}>
      <table className="w-full min-w-[40rem] text-left text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-dim [&_th]:uppercase">
        {children}
      </table>
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="!py-10 text-center text-muted">
        {text}
      </td>
    </tr>
  );
}

export function StatCard({ label, value, hint, tone = "brand" }: { label: string; value: string; hint?: string; tone?: "brand" | "gold" | "sky" | "success" }) {
  const tones = {
    brand: "from-violet-500/20",
    gold: "from-amber-400/20",
    sky: "from-sky-400/20",
    success: "from-emerald-400/20",
  } as const;
  return (
    <div className={cn("rounded-2xl border border-line bg-gradient-to-br to-surface/80 p-5", tones[tone])}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-dim">{hint}</p> : null}
    </div>
  );
}

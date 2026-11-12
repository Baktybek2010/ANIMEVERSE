import { CircleAlert, type LucideIcon } from "lucide-react";
import Image from "next/image";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton", className)} {...props} />;
}

type BadgeTone = "neutral" | "brand" | "gold" | "success" | "danger" | "sky";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-white/10 text-fg/90",
  brand: "bg-brand/20 text-brand-soft",
  gold: "bg-amber-400/15 text-gold",
  success: "bg-emerald-400/15 text-success",
  danger: "bg-rose-400/15 text-danger",
  sky: "bg-sky-400/15 text-sky",
};

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

type StateProps = {
  icon?: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, text, action, className }: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-white/[0.02] px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand/15 text-brand-soft">
          <Icon className="size-7" aria-hidden />
        </div>
      ) : null}
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {text ? <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{text}</p> : null}
      {action ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ icon: Icon = CircleAlert, title, text, action, className }: StateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-danger/25 bg-danger/5 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-danger/15 text-danger">
        <Icon className="size-7" aria-hidden />
      </div>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {text ? <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{text}</p> : null}
      {action ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
    </div>
  );
}

export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-semibold text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.42) }}
    >
      {src ? <Image src={src} alt="" fill sizes={`${size}px`} className="object-cover" /> : <span aria-hidden>{initial}</span>}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface/80 p-5 sm:p-6", className)} {...props}>
      {children}
    </div>
  );
}

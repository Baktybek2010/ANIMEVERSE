import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <defs>
          <linearGradient id="av-logo" x1="2" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a78bfa" />
            <stop offset="0.55" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#av-logo)" />
        <path d="M16 6.5 23.6 24h-3.7l-1.4-3.5h-5L12.1 24H8.4L16 6.5Zm0 6.9-1.5 4h3l-1.5-4Z" fill="#fff" />
        <circle cx="24.5" cy="8" r="1.6" fill="#fff" opacity="0.9" />
      </svg>
      {compact ? null : (
        <span className="font-display text-[1.05rem] font-bold tracking-[0.08em]">
          ANIME<span className="text-gradient">VERSE</span>
        </span>
      )}
    </span>
  );
}

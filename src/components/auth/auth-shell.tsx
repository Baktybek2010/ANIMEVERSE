import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-page flex min-h-[calc(100dvh-4rem)] items-center justify-center py-10 sm:py-16">
      <div className="relative w-full max-w-md">
        <div aria-hidden className="bg-brand-gradient absolute -inset-px -z-10 rounded-[1.6rem] opacity-40 blur-2xl" />
        <div className="rounded-3xl border border-line-strong bg-surface/90 p-6 shadow-card backdrop-blur-xl sm:p-8">
          <Logo className="mb-6" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
      {children}
    </p>
  );
}

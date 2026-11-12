"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** Модальное окно на нативном <dialog>: фокус-ловушка и Esc работают из коробки. */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,32rem)] rounded-2xl border border-line-strong bg-raised p-0 text-fg shadow-card",
        "open:animate-rise",
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-display text-lg font-semibold">{title}</h2>
              {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.close}
              className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/8 hover:text-fg"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {children ? <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div> : null}
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

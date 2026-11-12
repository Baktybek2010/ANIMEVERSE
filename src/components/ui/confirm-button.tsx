"use client";

import { type ReactNode, useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { Dialog } from "./dialog";

type ConfirmButtonProps = {
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
};

/** Кнопка с подтверждением для необратимых действий. */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "danger",
  size = "sm",
  className,
  children,
  disabled,
  ...rest
}: ConfirmButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant={variant} size={size} className={className} disabled={disabled} onClick={() => setOpen(true)} {...rest}>
        {children}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  await onConfirm();
                  setOpen(false);
                })
              }
            >
              {confirmLabel ?? t.common.confirm}
            </Button>
          </>
        }
      />
    </>
  );
}

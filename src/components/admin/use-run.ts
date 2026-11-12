"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import type { ActionResult, ErrorKey } from "@/lib/actions/result";

/**
 * Запуск серверного действия из админ-панели: индикатор, уведомления,
 * ошибки полей и обновление данных страницы.
 */
export function useRun() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, ErrorKey>>({});

  const run = useCallback(
    async <T,>(action: () => Promise<ActionResult<T>>, options: { success?: string; onSuccess?: (data: T) => void; refresh?: boolean } = {}): Promise<boolean> => {
      setPending(true);
      setFieldErrors({});
      try {
        const result = await action();
        if (!result.ok) {
          setFieldErrors(result.fieldErrors ?? {});
          toast.error(t.errors[result.error]);
          return false;
        }
        if (options.success) toast.success(options.success);
        options.onSuccess?.(result.data);
        if (options.refresh !== false) router.refresh();
        return true;
      } catch {
        toast.error(t.errors.network);
        return false;
      } finally {
        setPending(false);
      }
    },
    [router, t, toast],
  );

  const errorOf = (field: string): string | null => (fieldErrors[field] ? t.errors[fieldErrors[field]] : null);

  return { run, pending, errorOf };
}

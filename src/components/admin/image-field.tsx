"use client";

import { Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { useAdminI18n } from "@/i18n/admin-client";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { uploadMediaAction } from "@/lib/actions/admin/anime";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  hint: string;
  kind: "poster" | "banner";
  value: string;
  onChange: (url: string) => void;
  error?: string | null;
};

/** Поле изображения: загрузка файла в хранилище или ссылка. */
export function ImageField({ id, label, hint, kind, value, onChange, error }: Props) {
  const a = useAdminI18n();
  const { t } = useI18n();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    formData.set("kind", kind);
    setUploading(true);
    try {
      const result = await uploadMediaAction(formData);
      if (!result.ok) {
        toast.error(t.errors[result.error]);
        return;
      }
      onChange(result.data.url);
      toast.success(a.common.uploaded);
    } catch {
      toast.error(t.errors.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-fg/90">
        {label}
      </label>
      <div className="mt-1.5 flex items-start gap-4">
        <div className={cn("relative shrink-0 overflow-hidden rounded-xl border border-line bg-elevated", kind === "poster" ? "aspect-[2/3] w-24" : "aspect-video w-40")}>
          {value && /^https?:\/\//.test(value) ? <Image src={value} alt="" fill sizes="160px" className="object-cover" unoptimized /> : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            aria-label={`${a.common.upload}: ${label}`}
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" aria-hidden />
            {a.common.upload}
          </Button>
          <Input id={id} type="url" value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://…" aria-invalid={Boolean(error)} />
          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : (
            <p className="text-xs text-dim">{hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}

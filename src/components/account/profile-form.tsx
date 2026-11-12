"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useI18n } from "@/i18n/client";
import { applyServerErrors, fieldError } from "@/components/auth/form-utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Avatar, Card } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { removeAvatarAction, updateProfileAction, uploadAvatarAction } from "@/lib/actions/profile";
import { UPLOAD_LIMITS } from "@/lib/upload";
import { type ProfileInput, profileSchema } from "@/lib/validation/profile";

type Props = {
  profile: { displayName: string; username: string; bio: string; avatarUrl: string | null; email: string; roleLabel: string };
};

export function ProfileForm({ profile }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarPending, startAvatar] = useTransition();
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: profile.displayName, username: profile.username, bio: profile.bio },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await updateProfileAction(values);
    if (!result.ok) {
      applyServerErrors(setError, result.fieldErrors, ["displayName", "username", "bio"]);
      toast.error(t.errors[result.error]);
      return;
    }
    reset(values);
    toast.success(t.common.saved);
    router.refresh();
  });

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > UPLOAD_LIMITS.avatar) {
      toast.error(t.errors.fileTooLarge);
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startAvatar(async () => {
      const result = await uploadAvatarAction(formData);
      if (!result.ok) {
        toast.error(t.errors[result.error]);
        return;
      }
      setAvatarUrl(result.data.url);
      toast.success(t.account.profile.avatarUpdated);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display text-lg font-semibold">{t.account.profile.avatar}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <Avatar src={avatarUrl} name={profile.displayName} size={88} />
          <div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label={t.account.profile.changeAvatar}
                onChange={(event) => {
                  onFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <Button variant="secondary" size="sm" loading={avatarPending} onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" aria-hidden />
                {t.account.profile.changeAvatar}
              </Button>
              {avatarUrl ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={avatarPending}
                  onClick={() =>
                    startAvatar(async () => {
                      const result = await removeAvatarAction();
                      if (!result.ok) {
                        toast.error(t.errors[result.error]);
                        return;
                      }
                      setAvatarUrl(null);
                      toast.success(t.account.profile.avatarRemoved);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                  {t.account.profile.removeAvatar}
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-dim">{t.account.profile.avatarHint}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">{t.account.profile.title}</h2>
        <p className="mt-1 text-sm text-muted">{t.account.profile.subtitle}</p>
        <form onSubmit={onSubmit} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label={t.account.profile.displayName} htmlFor="profile-display-name" error={fieldError(errors, "displayName", t)}>
            <Input id="profile-display-name" maxLength={50} aria-invalid={Boolean(errors.displayName)} {...register("displayName")} />
          </Field>
          <Field label={t.account.profile.username} htmlFor="profile-username" hint={t.auth.usernameHint} error={fieldError(errors, "username", t)}>
            <Input id="profile-username" maxLength={24} autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(errors.username)} {...register("username")} />
          </Field>
          <Field label={t.account.profile.bio} htmlFor="profile-bio" error={fieldError(errors, "bio", t)} className="sm:col-span-2">
            <Textarea id="profile-bio" maxLength={500} placeholder={t.account.profile.bioPlaceholder} aria-invalid={Boolean(errors.bio)} {...register("bio")} />
          </Field>
          <Field label={t.account.profile.email} htmlFor="profile-email">
            <Input id="profile-email" value={profile.email} readOnly disabled />
          </Field>
          <Field label={t.account.profile.role} htmlFor="profile-role">
            <Input id="profile-role" value={profile.roleLabel} readOnly disabled />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              {isSubmitting ? t.common.saving : t.common.save}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

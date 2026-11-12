"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { type Locale, localeNames, locales, localizePath, splitLocale } from "@/i18n/config";
import { persistLocale } from "@/i18n/persist";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { applyServerErrors, fieldError } from "@/components/auth/form-utils";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { changePasswordAction, deleteAccountAction } from "@/lib/actions/auth";
import { savePreferencesAction } from "@/lib/actions/profile";
import { type ChangePasswordInput, changePasswordSchema } from "@/lib/validation/auth";

type Preferences = {
  autoplayNext: boolean;
  audioLang: string;
  subtitleLang: string;
  quality: string;
  emailNotifications: boolean;
};

const AUDIO_LANGS = ["ja", "ru", "en"];
const SUBTITLE_LANGS = ["ru", "en", "ja"];
const QUALITIES = ["auto", "1080p", "720p", "480p", "360p"];

function languageLabel(code: string, locale: string) {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return code;
  }
}

export function PreferencesForm({ initial, isPremium }: { initial: Preferences; isPremium: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [language, setLanguage] = useState<Locale>(locale);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await savePreferencesAction({ ...values, locale: language });
      if (!result.ok) {
        toast.error(t.errors[result.error]);
        return;
      }
      toast.success(t.common.saved);
      if (language !== locale) {
        persistLocale(language);
        router.push(localizePath(language, splitLocale(window.location.pathname).path));
      } else {
        router.refresh();
      }
    });

  return (
    <Card>
      <div className="space-y-7">
        <section aria-labelledby="settings-language">
          <h2 id="settings-language" className="font-display text-lg font-semibold">
            {t.account.settings.languageTitle}
          </h2>
          <p className="mt-1 text-sm text-muted">{t.account.settings.languageText}</p>
          <Select value={language} onChange={(event) => setLanguage(event.target.value as Locale)} aria-label={t.account.settings.languageTitle} className="mt-3 max-w-xs">
            {locales.map((item) => (
              <option key={item} value={item}>
                {localeNames[item]}
              </option>
            ))}
          </Select>
        </section>

        <section aria-labelledby="settings-playback" className="border-t border-line pt-6">
          <h2 id="settings-playback" className="font-display text-lg font-semibold">
            {t.account.settings.playbackTitle}
          </h2>
          <div className="mt-4 space-y-5">
            <Switch
              id="pref-autoplay"
              label={t.account.settings.autoplayNext}
              checked={values.autoplayNext}
              onChange={(autoplayNext) => setValues((current) => ({ ...current, autoplayNext }))}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.account.settings.audioLang} htmlFor="pref-audio">
                <Select id="pref-audio" value={values.audioLang} onChange={(event) => setValues((current) => ({ ...current, audioLang: event.target.value }))}>
                  <option value="">{t.common.all}</option>
                  {AUDIO_LANGS.map((code) => (
                    <option key={code} value={code}>
                      {code === "ja" ? t.account.settings.audioOriginal : languageLabel(code, locale)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.account.settings.subtitleLang} htmlFor="pref-subtitles">
                <Select id="pref-subtitles" value={values.subtitleLang} onChange={(event) => setValues((current) => ({ ...current, subtitleLang: event.target.value }))}>
                  <option value="">{t.common.all}</option>
                  <option value="off">{t.account.settings.subtitlesOff}</option>
                  {SUBTITLE_LANGS.map((code) => (
                    <option key={code} value={code}>
                      {languageLabel(code, locale)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.account.settings.quality} htmlFor="pref-quality" hint={isPremium ? undefined : t.account.settings.qualityPremium}>
                <Select
                  id="pref-quality"
                  value={isPremium ? values.quality : "auto"}
                  disabled={!isPremium}
                  onChange={(event) => setValues((current) => ({ ...current, quality: event.target.value }))}
                >
                  {QUALITIES.map((quality) => (
                    <option key={quality} value={quality}>
                      {quality === "auto" ? t.watch.qualityAuto : quality}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </section>

        <section aria-labelledby="settings-notifications" className="border-t border-line pt-6">
          <h2 id="settings-notifications" className="mb-4 font-display text-lg font-semibold">
            {t.account.settings.notificationsTitle}
          </h2>
          <Switch
            id="pref-email"
            label={t.account.settings.emailNotifications}
            checked={values.emailNotifications}
            onChange={(emailNotifications) => setValues((current) => ({ ...current, emailNotifications }))}
          />
        </section>

        <Button onClick={save} loading={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
      </div>
    </Card>
  );
}

export function ChangePasswordForm() {
  const { t } = useI18n();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await changePasswordAction(values);
    if (!result.ok) {
      applyServerErrors(setError, result.fieldErrors, ["currentPassword", "password", "confirmPassword"]);
      if (!result.fieldErrors) toast.error(t.errors[result.error]);
      return;
    }
    reset();
    toast.success(t.account.settings.passwordChanged);
  });

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold">{t.account.settings.securityTitle}</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 grid max-w-md gap-4">
        <Field label={t.account.settings.currentPassword} htmlFor="pwd-current" error={fieldError(errors, "currentPassword", t)}>
          <PasswordInput id="pwd-current" autoComplete="current-password" aria-invalid={Boolean(errors.currentPassword)} {...register("currentPassword")} />
        </Field>
        <Field label={t.account.settings.newPassword} htmlFor="pwd-new" hint={t.auth.passwordHint} error={fieldError(errors, "password", t)}>
          <PasswordInput id="pwd-new" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
        </Field>
        <Field label={t.auth.confirmPassword} htmlFor="pwd-confirm" error={fieldError(errors, "confirmPassword", t)}>
          <PasswordInput id="pwd-confirm" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
        </Field>
        <div>
          <Button type="submit" variant="secondary" loading={isSubmitting}>
            {t.account.settings.changePassword}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function DeleteAccount({ username }: { username: string }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Card className="border-danger/25">
      <h2 className="font-display text-lg font-semibold text-danger">{t.account.settings.dangerTitle}</h2>
      <p className="mt-1 text-sm text-muted">{t.account.settings.deleteAccountText}</p>
      <Button variant="danger" size="sm" className="mt-4" onClick={() => setOpen(true)}>
        {t.account.settings.deleteAccount}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.account.settings.deleteAccount}
        description={fmt(t.account.settings.deleteAccountConfirm, { username })}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              disabled={confirmation.trim() !== username}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteAccountAction(confirmation, locale);
                  if (result && !result.ok) {
                    toast.error(result.error === "alreadySubscribed" ? t.account.settings.deleteAccountActiveSub : t.errors[result.error]);
                  }
                })
              }
            >
              {t.account.settings.deleteAccount}
            </Button>
          </>
        }
      >
        <Field label={t.account.profile.username} htmlFor="delete-confirm">
          <Input id="delete-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" autoCapitalize="none" />
        </Field>
      </Dialog>
    </Card>
  );
}

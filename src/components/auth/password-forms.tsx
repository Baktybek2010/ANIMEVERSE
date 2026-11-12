"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { localizePath } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ButtonLink } from "@/components/ui/link";
import { forgotPasswordAction, resetPasswordAction } from "@/lib/actions/auth";
import type { ErrorKey } from "@/lib/actions/result";
import { type ForgotPasswordInput, forgotPasswordSchema, type ResetPasswordInput, resetPasswordSchema } from "@/lib/validation/auth";
import { FormAlert } from "./auth-shell";
import { applyServerErrors, fieldError } from "./form-utils";
import { PasswordInput } from "./password-input";

export function ForgotPasswordForm() {
  const { t, locale } = useI18n();
  const [formError, setFormError] = useState<ErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "", locale } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await forgotPasswordAction({ ...values, locale });
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setSentTo(values.email);
  });

  if (sentTo) {
    return (
      <div className="flex flex-col items-center text-center" role="status">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand/15 text-brand-soft">
          <MailCheck className="size-7" aria-hidden />
        </div>
        <h2 className="font-display text-lg font-semibold">{t.auth.resetSentTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{fmt(t.auth.resetSentText, { email: sentTo })}</p>
        <ButtonLink href="/login" variant="secondary" className="mt-6 w-full">
          {t.auth.backToLogin}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && formError !== "validation" ? <FormAlert>{t.errors[formError]}</FormAlert> : null}
      <Field label={t.auth.email} htmlFor="forgot-email" error={fieldError(errors, "email", t)}>
        <Input id="forgot-email" type="email" autoComplete="email" inputMode="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {t.auth.sendResetLink}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [formError, setFormError] = useState<ErrorKey | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await resetPasswordAction(values);
    if (!result.ok) {
      applyServerErrors(setError, result.fieldErrors, ["password", "confirmPassword"]);
      setFormError(result.error);
      return;
    }
    router.replace(`${localizePath(locale, "/account")}?notice=passwordUpdated`);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && formError !== "validation" && !Object.keys(errors).length ? <FormAlert>{t.errors[formError]}</FormAlert> : null}
      <Field label={t.auth.newPassword} htmlFor="reset-password" hint={t.auth.passwordHint} error={fieldError(errors, "password", t)}>
        <PasswordInput id="reset-password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
      </Field>
      <Field label={t.auth.confirmPassword} htmlFor="reset-confirm" error={fieldError(errors, "confirmPassword", t)}>
        <PasswordInput id="reset-confirm" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {t.auth.updatePassword}
      </Button>
    </form>
  );
}

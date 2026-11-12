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
import { useToast } from "@/components/ui/toast";
import { registerAction, resendConfirmationAction } from "@/lib/actions/auth";
import type { ErrorKey } from "@/lib/actions/result";
import { type RegisterInput, registerSchema } from "@/lib/validation/auth";
import { FormAlert } from "./auth-shell";
import { applyServerErrors, fieldError } from "./form-utils";
import { PasswordInput } from "./password-input";

export function RegisterForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<ErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "", locale },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await registerAction({ ...values, locale });
    if (!result.ok) {
      applyServerErrors(setError, result.fieldErrors, ["username", "email", "password", "confirmPassword"]);
      setFormError(result.error);
      return;
    }
    if (result.data.needsConfirmation) {
      setSentTo(result.data.email);
      return;
    }
    router.replace(localizePath(locale, "/"));
    router.refresh();
  });

  if (sentTo) {
    return (
      <div className="flex flex-col items-center text-center" role="status">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand/15 text-brand-soft">
          <MailCheck className="size-7" aria-hidden />
        </div>
        <h2 className="font-display text-lg font-semibold">{t.auth.checkEmailTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{fmt(t.auth.checkEmailText, { email: sentTo })}</p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <ButtonLink href="/login" className="w-full">
            {t.auth.backToLogin}
          </ButtonLink>
          <Button
            variant="ghost"
            loading={resending}
            onClick={async () => {
              setResending(true);
              const result = await resendConfirmationAction(sentTo, locale);
              setResending(false);
              if (result.ok) toast.success(t.auth.resent);
              else toast.error(t.errors[result.error]);
            }}
          >
            {t.auth.resend}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && formError !== "validation" && !Object.keys(errors).length ? <FormAlert>{t.errors[formError]}</FormAlert> : null}
      <Field label={t.auth.username} htmlFor="register-username" hint={t.auth.usernameHint} error={fieldError(errors, "username", t)}>
        <Input
          id="register-username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={24}
          aria-invalid={Boolean(errors.username)}
          {...register("username")}
        />
      </Field>
      <Field label={t.auth.email} htmlFor="register-email" error={fieldError(errors, "email", t)}>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </Field>
      <Field label={t.auth.password} htmlFor="register-password" hint={t.auth.passwordHint} error={fieldError(errors, "password", t)}>
        <PasswordInput id="register-password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
      </Field>
      <Field label={t.auth.confirmPassword} htmlFor="register-confirm" error={fieldError(errors, "confirmPassword", t)}>
        <PasswordInput
          id="register-confirm"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          {...register("confirmPassword")}
        />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? t.auth.signingUp : t.auth.signUp}
      </Button>
      <p className="text-center text-xs text-dim">{t.auth.termsNote}</p>
    </form>
  );
}

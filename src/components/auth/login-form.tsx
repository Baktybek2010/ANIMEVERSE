"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Link } from "@/components/ui/link";
import { loginAction, resendConfirmationAction } from "@/lib/actions/auth";
import type { ErrorKey } from "@/lib/actions/result";
import { type LoginInput, loginSchema } from "@/lib/validation/auth";
import { FormAlert } from "./auth-shell";
import { applyServerErrors, fieldError } from "./form-utils";
import { PasswordInput } from "./password-input";
import { useToast } from "@/components/ui/toast";

export function LoginForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [formError, setFormError] = useState<ErrorKey | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await loginAction(values, searchParams.get("next") ?? undefined);
    if (!result.ok) {
      applyServerErrors(setError, result.fieldErrors, ["email", "password"]);
      setFormError(result.error);
      return;
    }
    router.replace(result.data.redirectTo);
    router.refresh();
  });

  const resend = async () => {
    const result = await resendConfirmationAction(getValues("email"), locale);
    if (result.ok) toast.success(t.auth.resent);
    else toast.error(t.errors[result.error]);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && formError !== "validation" ? (
        <FormAlert>
          {t.errors[formError]}
          {formError === "emailNotConfirmed" ? (
            <button type="button" onClick={resend} className="mt-1 block font-medium text-fg underline underline-offset-2">
              {t.auth.resend}
            </button>
          ) : null}
        </FormAlert>
      ) : null}
      <Field label={t.auth.email} htmlFor="login-email" error={fieldError(errors, "email", t)}>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </Field>
      <Field label={t.auth.password} htmlFor="login-password" error={fieldError(errors, "password", t)}>
        <PasswordInput id="login-password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-sm text-brand-soft hover:underline">
          {t.auth.forgotPassword}
        </Link>
      </div>
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {isSubmitting ? t.auth.signingIn : t.auth.signIn}
      </Button>
    </form>
  );
}

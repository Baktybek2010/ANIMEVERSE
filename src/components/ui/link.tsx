"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { localizePath } from "@/i18n/config";
import { useLocale } from "@/i18n/client";
import { type ButtonSize, type ButtonVariant, buttonClasses } from "./button";

type LinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & { href: string };

/** Ссылка, автоматически добавляющая префикс текущего языка к внутренним путям. */
export function Link({ href, ...props }: LinkProps) {
  const locale = useLocale();
  const target = href.startsWith("/") && !href.startsWith("//") ? localizePath(locale, href) : href;
  return <NextLink href={target} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: LinkProps & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}

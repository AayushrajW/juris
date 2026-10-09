"use client";

import type { ServiceError } from "@/domain/result";
import { useTranslations } from "use-intl";

/**
 * Services report what went wrong as a code. This turns the code into words in
 * the page's language; the service's own text is for logs, never for people.
 */
export function useErrorText() {
  const t = useTranslations("errors");
  return (error: ServiceError) => t(`code_${error.code}`);
}

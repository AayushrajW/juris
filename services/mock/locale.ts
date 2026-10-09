import { demoLocale } from "@/data/mocks/locales";
import { DEFAULT_LOCALE, toLocale, type Locale } from "@/i18n/config";

/** The language the page is showing. The demo answers in the same one. */
export function currentLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  return toLocale(document.documentElement.lang);
}

export function demoText() {
  return demoLocale(currentLocale());
}

/** Marathi first: Juris is built for Maharashtra. */
export const LOCALES = ["mr", "hi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "mr";
export const LOCALE_COOKIE = "juris_locale";

/** Each language is always shown in its own script so people can find theirs. */
export const LOCALE_NAMES: Record<Locale, string> = {
  mr: "मराठी",
  hi: "हिन्दी",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Uses the saved choice. Without one, uses Hindi or Marathi if the phone lists
 * either among its languages (many are set to English first, with the owner's
 * own language second). Otherwise Marathi. English is never picked this way:
 * it is the usual phone default, not a sign of what the person reads best.
 */
export function pickLocale(saved: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(saved)) return saved;
  for (const entry of acceptLanguage?.split(",") ?? []) {
    const language = entry.split(";")[0].trim().toLowerCase().split("-")[0];
    if (language === "hi" || language === "mr") return language;
  }
  return DEFAULT_LOCALE;
}

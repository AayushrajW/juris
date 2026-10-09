"use client";

import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/server";
import { IntlProvider as BaseIntlProvider, useTranslations } from "use-intl";

/** Gives every screen its text in the chosen language. */
export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  return (
    // The library asks for a time zone for any date it formats itself. The app's
    // own dates are plain calendar days (lib/format.ts) and do not depend on it.
    <BaseIntlProvider locale={locale} messages={messages} timeZone="Asia/Kolkata">
      {children}
    </BaseIntlProvider>
  );
}

export function SkipLink() {
  const t = useTranslations("common");
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-navy focus:px-3 focus:py-2 focus:text-white"
    >
      {t("skipToContent")}
    </a>
  );
}

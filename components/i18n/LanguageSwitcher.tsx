"use client";

import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { Check, Languages } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
import { useState } from "react";

function chooseLocale(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
  // A full reload so every screen, and the sample content behind it, changes together.
  window.location.reload();
}

/** Three large buttons, each language written in its own script. */
export function LanguageChoices({ className }: { className?: string }) {
  const current = useLocale();
  return (
    <div className={cn("grid gap-2 sm:grid-cols-3", className)}>
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={active}
            onClick={() => (active ? undefined : chooseLocale(locale))}
            className={cn(
              "flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 px-4 text-[18px] font-semibold",
              active
                ? "border-primary bg-pastel-blue text-navy"
                : "border-border bg-surface text-navy hover:border-primary/40",
            )}
          >
            {LOCALE_NAMES[locale]}
            {active ? <Check className="size-5 text-primary" strokeWidth={2.5} aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** A small button showing the current language. Opens the three choices. */
export function LanguageSwitcher({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${t("language")}: ${LOCALE_NAMES[locale]}`}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-[15px] font-semibold",
          variant === "light"
            ? "border-white/25 text-white hover:bg-white/10"
            : "border-border bg-surface text-navy hover:bg-bg",
        )}
      >
        <Languages className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span lang={locale}>{LOCALE_NAMES[locale]}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("chooseLanguage")}>
        <LanguageChoices className="sm:grid-cols-1" />
      </Sheet>
    </>
  );
}

"use client";

import { BrandMark } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { APP_NAME } from "@/lib/constants";
import { useTranslations } from "use-intl";
import Link from "next/link";

export function MarketingHeader() {
  const t = useTranslations("landing");
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <BrandMark href="/" />
        <nav className="flex items-center gap-2 text-[15px] font-medium">
          <Link href="/#how-it-works" className="hidden min-h-11 items-center px-3 text-navy md:inline-flex">
            {t("headerHow")}
          </Link>
          <LanguageSwitcher />
          <Link
            href="/sign-up"
            className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-white hover:bg-primary-hover"
          >
            {t("headerStart")}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  const t = useTranslations("landing");
  const common = useTranslations("common");
  return (
    <footer className="border-t border-border bg-navy text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-semibold">{APP_NAME}</p>
          <p className="mt-2 text-[15px] text-white/80">{t("footerTagline")}</p>
        </div>
        <div className="text-[15px] text-white/85">
          <p className="font-semibold text-white">{t("footerOfficial")}</p>
          <ul className="mt-2 space-y-1">
            <li>
              <a
                className="inline-flex min-h-11 items-center underline-offset-2 hover:underline"
                href="https://nalsa.gov.in/"
                rel="noopener noreferrer"
              >
                {t("footerNalsa")}
              </a>
            </li>
            <li>
              <a
                className="inline-flex min-h-11 items-center underline-offset-2 hover:underline"
                href="https://ecourts.gov.in/"
                rel="noopener noreferrer"
              >
                {t("footerEcourts")}
              </a>
            </li>
          </ul>
        </div>
        <p className="text-[15px] text-white/80">{common("disclaimerLong", { app: APP_NAME })}</p>
      </div>
    </footer>
  );
}

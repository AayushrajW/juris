"use client";

import { useTranslations } from "use-intl";
import Link from "next/link";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-[26px] font-semibold text-navy">{t("notFoundTitle")}</h1>
      <p className="mt-3 text-[17px] text-muted">{t("notFoundBody")}</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-14 items-center rounded-xl bg-primary px-6 text-[17px] font-semibold text-white"
      >
        {t("backHome")}
      </Link>
    </main>
  );
}

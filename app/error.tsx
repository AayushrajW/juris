"use client";

import { Button } from "@/components/ui/Button";
import { useTranslations } from "use-intl";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  const common = useTranslations("common");
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-[26px] font-semibold text-navy">{t("title")}</h1>
      <p className="mt-3 text-[17px] text-muted">{t("body")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          {common("tryAgain")}
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex min-h-14 items-center rounded-xl border border-border bg-surface px-6 font-semibold text-navy"
        >
          {common("goHome")}
        </Link>
      </div>
    </main>
  );
}

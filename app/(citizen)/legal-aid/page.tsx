"use client";

import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import {
  EMERGENCY_HELPLINES,
  HELPLINES_LAST_CHECKED,
  LEGAL_HELPLINES,
  OFFICIAL_SITES,
  type Helpline,
} from "@/lib/helplines";
import { ExternalLink, Phone } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";

function CallCard({ line, urgent = false }: { line: Helpline; urgent?: boolean }) {
  const t = useTranslations("help");
  const common = useTranslations("common");
  return (
    <li>
      <a
        href={`tel:${line.dial}`}
        aria-label={`${t(line.name)}. ${common("call", { number: line.number })}`}
        className={cn(
          "flex min-h-20 items-center gap-4 rounded-2xl border-2 p-4",
          urgent ? "border-danger/30 bg-pastel-red" : "border-border bg-surface hover:border-primary/40",
        )}
      >
        <span
          className={cn(
            "inline-flex size-12 shrink-0 items-center justify-center rounded-full text-white",
            urgent ? "bg-danger" : "bg-success",
          )}
        >
          <Phone className="size-6" strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold text-navy">{t(line.name)}</span>
          <span className="mt-0.5 block text-[15px] text-muted">{t(line.body)}</span>
        </span>
        <span className="shrink-0 text-[20px] font-bold tabular-nums text-navy">{line.number}</span>
      </a>
    </li>
  );
}

export default function LegalAidPage() {
  const t = useTranslations("help");
  const common = useTranslations("common");
  const locale = useLocale();

  return (
    <AppPage className="max-w-3xl">
      <PageHeading title={t("title")} subtitle={t("subtitle")} />

      <section className="mt-6">
        <h2 className="text-[19px] font-semibold text-navy">{t("callTitle")}</h2>
        <ul className="mt-3 space-y-3">
          {LEGAL_HELPLINES.map((line) => (
            <CallCard key={line.id} line={line} />
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-[19px] font-semibold text-navy">{t("emergencyTitle")}</h2>
        <ul className="mt-3 space-y-3">
          {EMERGENCY_HELPLINES.map((line) => (
            <CallCard key={line.id} line={line} urgent={line.id === "emergency"} />
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-[19px] font-semibold text-navy">{t("websitesTitle")}</h2>
        <ul className="mt-3 space-y-2">
          {OFFICIAL_SITES.map((site) => (
            <li key={site.id}>
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ns-card flex min-h-14 items-center gap-3 px-4 py-3 hover:border-primary/30"
              >
                <ExternalLink className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                <span className="flex-1 text-[16px] font-semibold text-navy">{t(site.name)}</span>
                <span className="sr-only">{common("opensWebsite")}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 rounded-2xl bg-pastel-orange p-5">
        <p className="text-[17px] font-semibold text-navy">{t("notActTitle", { app: APP_NAME })}</p>
        <p className="mt-1 text-[16px] text-ink">{t("notActBody")}</p>
      </div>

      <p className="mt-4 text-[14px] text-muted">
        {t("checked", { date: formatDate(HELPLINES_LAST_CHECKED, locale) ?? HELPLINES_LAST_CHECKED })}
      </p>
    </AppPage>
  );
}

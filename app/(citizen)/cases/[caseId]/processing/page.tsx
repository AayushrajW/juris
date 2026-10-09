"use client";

import { Alert } from "@/components/ui/Display";
import { AppPage } from "@/components/ui/AppKit";
import { cn } from "@/lib/cn";
import { analysisService, caseRepository } from "@/services";
import { useTranslations } from "use-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const STEPS = ["step1", "step2", "step3"] as const;

export default function ProcessingPage() {
  const t = useTranslations("processing");
  const params = useParams<{ caseId: string }>();
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers = [
      window.setTimeout(() => setActive(1), 700),
      window.setTimeout(() => setActive(2), 1400),
    ];

    async function run() {
      const existing = await caseRepository.getById(params.caseId);
      if (cancelled) return;
      if (!existing.ok) {
        setFailed(true);
        return;
      }
      if (existing.data.status === "ready" || existing.data.status === "needs_more_info") {
        router.replace(`/cases/${params.caseId}`);
        return;
      }
      const result = await analysisService.startProcessing(params.caseId);
      if (cancelled) return;
      if (!result.ok) {
        setFailed(true);
        return;
      }
      router.replace(`/cases/${params.caseId}`);
    }

    void run().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [params.caseId, router]);

  return (
    <AppPage className="max-w-lg">
      <h1 className="text-[24px] font-semibold text-navy">{t("title")}</h1>
      <p className="mt-2 text-[15px] text-muted">{t("subtitle")}</p>
      <ol className="mt-8 space-y-3" aria-live="polite">
        {STEPS.map((key, i) => {
          const state = i < active ? "done" : i === active ? (failed ? "stopped" : "working") : "waiting";
          return (
            <li
              key={key}
              className={cn(
                "rounded-2xl border px-4 py-3 text-[16px]",
                i <= active ? "border-primary/30 bg-pastel-blue text-navy" : "border-border text-muted",
              )}
            >
              <span className="font-semibold">{t(state)}</span> — {t(key)}
            </li>
          );
        })}
      </ol>
      {failed ? (
        <div className="mt-6">
          <Alert tone="danger" title={t("errTitle")}>
            {t("errBody")}{" "}
            <Link className="font-semibold underline" href="/cases">
              {t("backToProblems")}
            </Link>
          </Alert>
        </div>
      ) : null}
    </AppPage>
  );
}

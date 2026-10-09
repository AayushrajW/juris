"use client";

import { DeleteProblem } from "@/components/cases/DeleteProblem";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Display";
import { AppPage } from "@/components/ui/AppKit";
import type { AnalysisJob } from "@/domain/analysis";
import type { ServiceError } from "@/domain/result";
import { useErrorText } from "@/hooks/useErrorText";
import { cn } from "@/lib/cn";
import { analysisService } from "@/services";
import { useLocale, useTranslations } from "use-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const STEPS = ["step1", "step2", "step3"] as const;

/** Which of the three lines is being worked on in each state of the job. */
const STEP_OF: Record<AnalysisJob["state"], number> = { queued: 0, reading: 1, writing: 2, ready: 3, failed: 0 };

// Checks come quickly at first and then ease off, so a long reading does not
// mean hundreds of requests from a phone on a slow connection.
const FIRST_CHECK_MS = 500;
const SLOWEST_CHECK_MS = 5000;
/** After a failed check, how long to wait before the next one when the service does not say. */
const BACK_OFF_MS = 4000;
/** How many checks in a row may fail before the page stops and says so. */
const MAX_MISSES = 5;
/** After this long the page says it is taking a while, and that it is safe to leave. */
const SLOW_AFTER_MS = 45_000;

type Stopped = {
  error?: ServiceError;
  /** Asking again may work. */
  canRetry: boolean;
  /** The problem has no paper and no story, so there is nothing a reading could do. */
  nothingToRead?: boolean;
  /** This was a second reading, and the explanation from the first is still there. */
  keptEarlier?: boolean;
};

export default function ProcessingPage() {
  const t = useTranslations("processing");
  const common = useTranslations("common");
  const errorText = useErrorText();
  const locale = useLocale();
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState<Stopped | null>(null);
  const [slow, setSlow] = useState(false);
  // Pressing "Try again" changes this, which runs the watch again from the top.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let misses = 0;
    let delay = FIRST_CHECK_MS;
    const began = Date.now();

    function later(ms: number) {
      timer = window.setTimeout(() => void check(), ms);
    }

    function show(job: AnalysisJob) {
      if (job.state === "ready") {
        router.replace(`/cases/${caseId}`);
        return;
      }
      if (job.state === "failed") {
        void stopFailed(job.failure?.retryable ?? true);
        return;
      }
      setActive(STEP_OF[job.state]);
      if (Date.now() - began > SLOW_AFTER_MS) setSlow(true);
      later(delay);
      delay = Math.min(delay * 1.5, SLOWEST_CHECK_MS);
    }

    // A reading that fails takes nothing away. If the problem was explained
    // before, say so and lead back to that, instead of offering to delete it.
    async function stopFailed(canRetry: boolean) {
      const earlier = await analysisService.get(caseId);
      if (!cancelled) setStopped({ canRetry, keptEarlier: earlier.ok });
    }

    // The reading runs on the service's side. This page only watches it, so
    // closing the page and coming back picks up wherever it has got to.
    async function check() {
      const result = await analysisService.status(caseId);
      if (cancelled) return;
      if (result.ok) {
        misses = 0;
        if (result.data) return show(result.data);
        // A draft whose reading was never asked for (the form was closed half way).
        return begin();
      }
      const { error } = result;
      const passing = error.code === "rate_limited" || error.code === "unavailable";
      misses += 1;
      if (!passing || misses >= MAX_MISSES) return setStopped({ error, canRetry: passing });
      later(error.retryAfterSeconds ? error.retryAfterSeconds * 1000 : BACK_OFF_MS);
    }

    // Starts a reading if there is none or the last one failed; otherwise joins the one there is.
    async function begin() {
      const started = await analysisService.start(caseId, { language: locale });
      if (cancelled) return;
      if (started.ok) return show(started.data);
      const { error } = started;
      const nothingToRead = error.reason === "nothing_to_read";
      setStopped({ error, nothingToRead, canRetry: error.code !== "not_found" && !nothingToRead });
    }

    // The first look only watches. "Try again" asks for the reading itself.
    void (attempt > 0 ? begin() : check());
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [caseId, router, locale, attempt]);

  function tryAgain() {
    setStopped(null);
    setSlow(false);
    setActive(0);
    setAttempt((n) => n + 1);
  }

  const gone = stopped?.error?.code === "not_found";

  return (
    <AppPage className="max-w-lg">
      <h1 className="text-[24px] font-semibold text-navy">{t("title")}</h1>
      <p className="mt-2 text-[15px] text-muted">{t("subtitle")}</p>
      <ol className="mt-8 space-y-3" aria-live="polite">
        {STEPS.map((key, i) => {
          const state = i < active ? "done" : i === active ? (stopped ? "stopped" : "working") : "waiting";
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
      {slow && !stopped ? (
        <p className="mt-6 rounded-xl bg-pastel-blue px-4 py-3 text-[16px] leading-relaxed text-ink" role="status">
          {t("slow")}{" "}
          <Link className="font-semibold underline" href="/cases">
            {t("backToProblems")}
          </Link>
        </p>
      ) : null}
      {stopped ? (
        <div className="mt-6 space-y-4">
          <Alert tone="danger" title={t("errTitle")}>
            {stopped.nothingToRead ? t("errNothing") : stopped.error ? errorText(stopped.error) : t("errBody")}{" "}
            <Link className="font-semibold underline" href="/cases">
              {t("backToProblems")}
            </Link>
          </Alert>
          {stopped.canRetry ? (
            <Button size="lg" className="w-full" onClick={tryAgain}>
              {common("tryAgain")}
            </Button>
          ) : null}
          {stopped.keptEarlier ? (
            <p className="rounded-xl bg-pastel-green px-4 py-3 text-[16px] leading-relaxed text-ink">
              {t("keptEarlier")}{" "}
              <Link className="font-semibold underline" href={`/cases/${caseId}`}>
                {t("seeEarlier")}
              </Link>
            </p>
          ) : gone ? null : (
            // A problem that could not be read must still be removable.
            <DeleteProblem caseId={caseId} onDeleted={() => router.replace("/cases")} />
          )}
        </div>
      ) : null}
    </AppPage>
  );
}

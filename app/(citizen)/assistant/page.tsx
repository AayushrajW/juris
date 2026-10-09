"use client";

import { AskAiPanel } from "@/components/assistant/AskAiPanel";
import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Display";
import { Select } from "@/components/ui/Field";
import { useErrorText } from "@/hooks/useErrorText";
import { caseService } from "@/services";
import type { CaseRecord } from "@/domain/case";
import type { ServiceError } from "@/domain/result";
import { useTranslations } from "use-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function AssistantInner() {
  const t = useTranslations("assistant");
  const common = useTranslations("common");
  const errorText = useErrorText();
  const search = useSearchParams();
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [loadTry, setLoadTry] = useState(0);

  // Questions are answered from an explanation, so only problems that have one are offered.
  useEffect(() => {
    let cancelled = false;
    void caseService.list({ status: ["ready", "needs_more_info"], limit: 50 }).then((r) => {
      if (cancelled) return;
      // A list that could not be read is not an empty list.
      if (r.ok) setCases(r.data.items);
      setError(r.ok ? null : r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [loadTry]);

  // Only a problem that belongs to this person can be picked, whatever the link says.
  const linked = search.get("caseId");
  const caseId =
    cases?.find((c) => c.id === chosen)?.id ?? cases?.find((c) => c.id === linked)?.id ?? cases?.[0]?.id;

  return (
    <AppPage>
      <PageHeading title={t("title")} subtitle={t("subtitle")} />
      {error ? (
        <div className="mt-5 space-y-3">
          <Alert tone="danger" title={common("couldNotLoad")}>
            {errorText(error)}
          </Alert>
          <Button variant="secondary" size="lg" onClick={() => setLoadTry((n) => n + 1)}>
            {common("tryAgain")}
          </Button>
        </div>
      ) : cases === null ? (
        <Skeleton className="mt-5 h-64 w-full" />
      ) : caseId ? (
        <>
          {cases.length > 1 ? (
            <div className="mt-5 max-w-md">
              <Select
                id="case"
                label={t("aboutWhich")}
                value={caseId}
                onChange={(e) => setChosen(e.target.value)}
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="mt-5 ns-card p-4 md:p-5">
            {/* The key starts a fresh conversation view when the problem changes. */}
            <AskAiPanel key={caseId} caseId={caseId} />
          </div>
        </>
      ) : (
        <div className="mt-5">
          <EmptyState
            title={t("startFirstTitle")}
            body={t("startFirstBody")}
            action={
              <Link
                href="/cases/new"
                className="inline-flex min-h-14 items-center rounded-xl bg-primary px-6 text-[17px] font-semibold text-white"
              >
                {t("newProblem")}
              </Link>
            }
          />
        </div>
      )}
    </AppPage>
  );
}

export default function AssistantPage() {
  return (
    <Suspense>
      <AssistantInner />
    </Suspense>
  );
}

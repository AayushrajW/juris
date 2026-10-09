"use client";

import { AskAiPanel } from "@/components/assistant/AskAiPanel";
import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { EmptyState, Skeleton } from "@/components/ui/Display";
import { Select } from "@/components/ui/Field";
import { useSession } from "@/hooks/useSession";
import { caseRepository } from "@/services";
import type { CaseRecord } from "@/domain/case";
import { useTranslations } from "use-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function AssistantInner() {
  const t = useTranslations("assistant");
  const { user } = useSession();
  const search = useSearchParams();
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void caseRepository.listByCitizen(user.id).then((r) => {
      if (!cancelled) setCases(r.ok ? r.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Only a problem that belongs to this person can be picked, whatever the link says.
  const linked = search.get("caseId");
  const caseId =
    cases?.find((c) => c.id === chosen)?.id ?? cases?.find((c) => c.id === linked)?.id ?? cases?.[0]?.id;

  return (
    <AppPage>
      <PageHeading title={t("title")} subtitle={t("subtitle")} />
      {cases === null ? (
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

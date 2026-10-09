"use client";

import { AskAiPanel } from "@/components/assistant/AskAiPanel";
import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { EmptyState } from "@/components/ui/Display";
import { useSession } from "@/hooks/useSession";
import { caseRepository } from "@/services";
import type { CaseRecord } from "@/domain/case";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function AssistantInner() {
  const { user } = useSession();
  const search = useSearchParams();
  const [cases, setCases] = useState<CaseRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    void caseRepository.listByCitizen(user.id).then((r) => {
      if (r.ok) setCases(r.data);
    });
  }, [user]);

  const caseId = search.get("caseId") ?? cases[0]?.id;

  return (
    <AppPage>
      <PageHeading
        title="Ask a question"
        subtitle="Use everyday words. Answers here are a demo, not a lawyer."
      />
      <div className="mt-5 ns-card p-4 md:p-5">
        {caseId ? (
          <AskAiPanel caseId={caseId} seedQuestion={search.get("q") ?? undefined} />
        ) : (
          <EmptyState
            title="Start a case first"
            body="The assistant stays attached to a case so answers stay on your papers."
            action={
              <Link href="/cases/new" className="text-sm font-semibold text-primary">
                New case →
              </Link>
            }
          />
        )}
      </div>
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

"use client";

import { CaseCard } from "@/components/cases/CaseCard";
import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Display";
import { Select } from "@/components/ui/Field";
import { useSession } from "@/hooks/useSession";
import type { CaseRecord, CaseStatus } from "@/domain/case";
import { CASE_STATUS_LABEL } from "@/domain/case";
import { caseRepository } from "@/services";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function CaseHistoryPage() {
  const { user } = useSession();
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [filter, setFilter] = useState<CaseStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void caseRepository.listByCitizen(user.id).then((result) => {
      if (result.ok) setCases(result.data);
      else setError(result.message);
    });
  }, [user]);

  const visible = useMemo(() => {
    if (!cases) return [];
    if (filter === "all") return cases;
    return cases.filter((c) => c.status === filter);
  }, [cases, filter]);

  return (
    <AppPage>
      <PageHeading
        title="My problems"
        subtitle="Tap one to see what happened and what to do."
        actions={
          <Link href="/cases/new">
            <Button>+ New Case</Button>
          </Link>
        }
      />
      <div className="mt-6 max-w-xs">
        <Select
          id="status"
          label="Status"
          value={filter}
          onChange={(e) => setFilter(e.target.value as CaseStatus | "all")}
        >
          <option value="all">All</option>
          {(Object.keys(CASE_STATUS_LABEL) as CaseStatus[]).map((s) => (
            <option key={s} value={s}>
              {CASE_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-6 grid gap-2.5">
        {error ? (
          <Alert tone="danger" title="Could not load">
            {error}
          </Alert>
        ) : null}
        {cases === null && !error ? <Skeleton className="h-16" /> : null}
        {cases && visible.length === 0 ? (
          <EmptyState title="Nothing in this list" body="Try another status, or start a new case." />
        ) : null}
        {visible.map((record) => (
          <CaseCard key={record.id} record={record} />
        ))}
      </div>
    </AppPage>
  );
}

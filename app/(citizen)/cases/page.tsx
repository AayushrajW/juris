"use client";

import { CaseCard } from "@/components/cases/CaseCard";
import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Display";
import { Select } from "@/components/ui/Field";
import { useSession } from "@/hooks/useSession";
import type { CaseRecord, CaseStatus } from "@/domain/case";
import { caseRepository } from "@/services";
import { Plus } from "lucide-react";
import { useTranslations } from "use-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/** Only the states a person can actually see in their list. */
const FILTERS: CaseStatus[] = ["ready", "needs_more_info", "processing"];

export default function CaseHistoryPage() {
  const t = useTranslations("cases");
  const tStatus = useTranslations("status");
  const common = useTranslations("common");
  const { user } = useSession();
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [filter, setFilter] = useState<CaseStatus | "all">("all");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void caseRepository.listByCitizen(user.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setCases(result.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visible = useMemo(() => {
    if (!cases) return [];
    if (filter === "all") return cases;
    return cases.filter((c) => c.status === filter);
  }, [cases, filter]);

  return (
    <AppPage>
      <PageHeading
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link
            href="/cases/new"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-[16px] font-semibold text-white hover:bg-primary-hover"
          >
            <Plus className="size-5" strokeWidth={2} aria-hidden />
            {t("new")}
          </Link>
        }
      />
      <div className="mt-6 max-w-xs">
        <Select
          id="status"
          label={t("filterLabel")}
          value={filter}
          onChange={(e) => setFilter(e.target.value as CaseStatus | "all")}
        >
          <option value="all">{t("filterAll")}</option>
          {FILTERS.map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-6 grid gap-2.5">
        {failed ? <Alert tone="danger" title={common("couldNotLoad")} /> : null}
        {cases === null && !failed ? <Skeleton className="h-16" /> : null}
        {cases && visible.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : null}
        {visible.map((record) => (
          <CaseCard key={record.id} record={record} />
        ))}
      </div>
    </AppPage>
  );
}

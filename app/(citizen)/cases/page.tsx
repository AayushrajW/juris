"use client";

import { CaseCard } from "@/components/cases/CaseCard";
import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Display";
import { Select } from "@/components/ui/Field";
import type { CaseRecord, CaseStatus } from "@/domain/case";
import type { ServiceError } from "@/domain/result";
import { useErrorText } from "@/hooks/useErrorText";
import { caseService } from "@/services";
import { Plus } from "lucide-react";
import { useTranslations } from "use-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Only the states a person can actually see in their list. */
const FILTERS: CaseStatus[] = ["ready", "needs_more_info", "processing"];

type Filter = CaseStatus | "all";

const statusOf = (filter: Filter) => (filter === "all" ? undefined : filter);

export default function CaseHistoryPage() {
  const t = useTranslations("cases");
  const tStatus = useTranslations("status");
  const common = useTranslations("common");
  const errorText = useErrorText();
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  // Where the next page starts, when there is one.
  const [more, setMore] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<ServiceError | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Shown beside the button, which is where the person is looking when it fails.
  const [moreError, setMoreError] = useState<ServiceError | null>(null);

  // The service does the filtering: the list comes in pages, so this page never holds all of it.
  useEffect(() => {
    let cancelled = false;
    void caseService.list({ status: statusOf(filter) }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setCases(result.data.items);
      setMore(result.data.nextCursor);
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  function chooseFilter(next: Filter) {
    setCases(null);
    setMore(null);
    setMoreError(null);
    setFilter(next);
  }

  async function showMore() {
    if (!more) return;
    setLoadingMore(true);
    setMoreError(null);
    const result = await caseService.list({ status: statusOf(filter), cursor: more });
    setLoadingMore(false);
    if (!result.ok) {
      setMoreError(result.error);
      return;
    }
    setCases((current) => [...(current ?? []), ...result.data.items]);
    setMore(result.data.nextCursor);
  }

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
          // Not while more of the old list is on its way: it would land in the new one.
          disabled={loadingMore}
          onChange={(e) => chooseFilter(e.target.value as Filter)}
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
        {error ? <Alert tone="danger" title={common("couldNotLoad")}>{errorText(error)}</Alert> : null}
        {cases === null && !error ? <Skeleton className="h-16" /> : null}
        {cases && cases.length === 0 ? <EmptyState title={t("emptyTitle")} body={t("emptyBody")} /> : null}
        {cases?.map((record) => (
          <CaseCard key={record.id} record={record} />
        ))}
        {moreError ? (
          <p className="text-[15px] text-danger" role="alert">
            {errorText(moreError)}
          </p>
        ) : null}
        {more ? (
          <Button variant="secondary" size="lg" onClick={() => void showMore()} disabled={loadingMore}>
            {common("showMore")}
          </Button>
        ) : null}
      </div>
    </AppPage>
  );
}

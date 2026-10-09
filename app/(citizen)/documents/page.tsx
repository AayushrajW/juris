"use client";

import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Display";
import type { DocumentListing } from "@/domain/document";
import type { ServiceError } from "@/domain/result";
import { useErrorText } from "@/hooks/useErrorText";
import { formatFileSize } from "@/lib/format";
import { documentService } from "@/services";
import { FileText } from "lucide-react";
import { useTranslations } from "use-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DocumentsPage() {
  const t = useTranslations("documents");
  const common = useTranslations("common");
  const errorText = useErrorText();
  const [rows, setRows] = useState<DocumentListing[] | null>(null);
  const [more, setMore] = useState<string | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Shown beside the button, which is where the person is looking when it fails.
  const [moreError, setMoreError] = useState<ServiceError | null>(null);

  useEffect(() => {
    let cancelled = false;
    void documentService.listAll().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRows(result.data.items);
      setMore(result.data.nextCursor);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function showMore() {
    if (!more) return;
    setLoadingMore(true);
    setMoreError(null);
    const result = await documentService.listAll({ cursor: more });
    setLoadingMore(false);
    if (!result.ok) {
      setMoreError(result.error);
      return;
    }
    setRows((current) => [...(current ?? []), ...result.data.items]);
    setMore(result.data.nextCursor);
  }

  return (
    <AppPage>
      <PageHeading title={t("title")} subtitle={t("subtitle")} />
      <div className="mt-6 grid gap-3">
        {error ? <Alert tone="danger" title={common("couldNotLoad")}>{errorText(error)}</Alert> : null}
        {rows === null && !error ? <Skeleton className="h-16" /> : null}
        {rows && rows.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={
              <Link
                href="/cases/new?mode=document"
                className="inline-flex min-h-14 items-center rounded-xl bg-primary px-6 text-[17px] font-semibold text-white"
              >
                {t("emptyCta")}
              </Link>
            }
          />
        ) : null}
        {rows?.map((doc) => (
          <Link
            key={doc.id}
            href={`/cases/${doc.caseId}`}
            className="ns-card flex min-h-16 items-center gap-3 p-4 hover:border-primary/30"
          >
            <FileText className="size-6 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-semibold text-navy">{doc.fileName}</span>
              <span className="mt-0.5 block text-[14px] text-muted">
                {doc.caseTitle} · {formatFileSize(doc.byteSize)}
              </span>
            </span>
          </Link>
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

"use client";

import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Display";
import { useSession } from "@/hooks/useSession";
import type { UploadedDocument } from "@/domain/document";
import type { CaseRecord } from "@/domain/case";
import { caseRepository, documentService } from "@/services";
import { formatFileSize } from "@/lib/format";
import { FileText } from "lucide-react";
import { useTranslations } from "use-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = { doc: UploadedDocument; record: CaseRecord };

export default function DocumentsPage() {
  const t = useTranslations("documents");
  const common = useTranslations("common");
  const { user } = useSession();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const list = await caseRepository.listByCitizen(user.id);
      if (cancelled) return;
      if (!list.ok) {
        setFailed(true);
        return;
      }
      const docs = await Promise.all(list.data.map((record) => documentService.getByCaseId(record.id)));
      if (cancelled) return;
      const pairs: Row[] = [];
      docs.forEach((doc, i) => {
        if (doc.ok && doc.data) pairs.push({ doc: doc.data, record: list.data[i] });
      });
      setRows(pairs);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <AppPage>
      <PageHeading title={t("title")} subtitle={t("subtitle")} />
      <div className="mt-6 grid gap-3">
        {failed ? <Alert tone="danger" title={common("couldNotLoad")} /> : null}
        {rows === null && !failed ? <Skeleton className="h-16" /> : null}
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
        {rows?.map(({ doc, record }) => (
          <Link
            key={doc.id}
            href={`/cases/${record.id}`}
            className="ns-card flex min-h-16 items-center gap-3 p-4 hover:border-primary/30"
          >
            <FileText className="size-6 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-semibold text-navy">{doc.fileName}</span>
              <span className="mt-0.5 block text-[14px] text-muted">
                {record.title} · {formatFileSize(doc.byteSize)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </AppPage>
  );
}

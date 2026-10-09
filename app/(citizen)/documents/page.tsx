"use client";

import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Display";
import { useSession } from "@/hooks/useSession";
import type { UploadedDocument } from "@/domain/document";
import type { CaseRecord } from "@/domain/case";
import { caseRepository, documentService } from "@/services";
import { formatFileSize } from "@/lib/format";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DocumentsPage() {
  const { user } = useSession();
  const [rows, setRows] = useState<{ doc: UploadedDocument; record: CaseRecord }[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const list = await caseRepository.listByCitizen(user.id);
      if (!list.ok) return;
      const pairs: { doc: UploadedDocument; record: CaseRecord }[] = [];
      for (const record of list.data) {
        const doc = await documentService.getByCaseId(record.id);
        if (doc.ok && doc.data) pairs.push({ doc: doc.data, record });
      }
      setRows(pairs);
      setReady(true);
    })();
  }, [user]);

  return (
    <AppPage>
      <PageHeading title="My Documents" subtitle="Files stored in this browser for the prototype." />
      <div className="mt-6 grid gap-3">
        {ready && rows.length === 0 ? (
          <EmptyState
            title="No documents yet"
            body="Upload a notice or contract when you start a case."
            action={
              <Link href="/cases/new?mode=document">
                <Button>Upload a document</Button>
              </Link>
            }
          />
        ) : null}
        {rows.map(({ doc, record }) => (
          <Link key={doc.id} href={`/cases/${record.id}`} className="ns-card block p-4 hover:border-primary/25">
            <p className="text-[14px] font-semibold text-navy">{doc.fileName}</p>
            <p className="mt-1 text-[12px] text-muted">
              {record.title} · {formatFileSize(doc.byteSize)}
            </p>
          </Link>
        ))}
      </div>
    </AppPage>
  );
}

"use client";

import { AskAiPanel } from "@/components/assistant/AskAiPanel";
import { CaseStatusBadge } from "@/components/cases/CaseStatusBadge";
import { LawyerCard } from "@/components/lawyers/LawyerCard";
import { AppPage, Tabs } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Alert, Badge, Card, EmptyState, Skeleton } from "@/components/ui/Display";
import { Sheet } from "@/components/ui/Sheet";
import { URGENCY_LABEL, type CaseAnalysis } from "@/domain/analysis";
import type { CaseRecord } from "@/domain/case";
import type { ProblemDescription, UploadedDocument } from "@/domain/document";
import { formatDate } from "@/lib/format";
import { sortLawyersByMatch } from "@/lib/lawyerMatch";
import { analysisService, caseRepository, documentService, lawyerRepository } from "@/services";
import type { LawyerProfile } from "@/domain/lawyer";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const TABS = [
  { id: "overview", label: "What happened" },
  { id: "plan", label: "What to do" },
  { id: "lawyers", label: "Get help" },
];

function urgencyTone(u: CaseAnalysis["deadlines"][number]["urgency"]) {
  if (u === "urgent") return "urgent" as const;
  if (u === "soon") return "warning" as const;
  if (u === "upcoming") return "info" as const;
  return "neutral" as const;
}

export default function CaseAnalysisPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [analysis, setAnalysis] = useState<CaseAnalysis | null>(null);
  const [doc, setDoc] = useState<UploadedDocument | null>(null);
  const [desc, setDesc] = useState<ProblemDescription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [aiOpen, setAiOpen] = useState(false);
  const [lawyers, setLawyers] = useState<LawyerProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const c = await caseRepository.getById(caseId);
      if (!c.ok) {
        if (!cancelled) setError(c.message);
        return;
      }
      if (!cancelled) setRecord(c.data);
      const [a, d, p, l] = await Promise.all([
        analysisService.getAnalysis(caseId),
        documentService.getByCaseId(caseId),
        documentService.getDescription(caseId),
        lawyerRepository.list(),
      ]);
      if (cancelled) return;
      if (a.ok) setAnalysis(a.data);
      else setError(a.message);
      if (d.ok) setDoc(d.data);
      if (p.ok) setDesc(p.data);
      if (l.ok) setLawyers(l.data);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const ranked = useMemo(() => {
    if (!record) return [];
    return sortLawyersByMatch(lawyers, {
      category: record.category,
      city: record.location?.city,
      state: record.location?.state,
    }).slice(0, 4);
  }, [lawyers, record]);

  if (error && !record) {
    return (
      <AppPage>
        <Alert tone="danger" title="Case not found">
          {error}{" "}
          <Link className="font-medium underline" href="/cases">
            Back to cases
          </Link>
        </Alert>
      </AppPage>
    );
  }

  if (!record || !analysis) {
    return (
      <AppPage>
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="mt-4 h-40 w-full" />
      </AppPage>
    );
  }

  const nextStep = analysis.nextSteps.slice().sort((a, b) => a.order - b.order)[0];
  const attentionText =
    analysis.risks[0]?.text ??
    (() => {
      const d = analysis.deadlines.find((item) => item.urgency === "urgent" || item.urgency === "soon");
      return d ? `${d.label}${d.date ? ` — ${formatDate(d.date)}` : ""}` : null;
    })();

  const documentPane = (
    <div className="space-y-3">
      {doc?.previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={doc.previewUrl} alt={`Preview of ${doc.fileName}`} className="w-full" />
        </div>
      ) : doc ? (
        <EmptyState
          title={doc.fileName}
          body="In-browser PDF preview is not included in this prototype. The file name is stored locally only."
        />
      ) : (
        <EmptyState title="No document in this file" body={desc?.narrative ?? "This case was started from a description."} />
      )}
      {desc ? (
        <Card>
          <p className="text-sm font-semibold text-navy">Your description</p>
          <p className="mt-2 text-sm text-ink/90">{desc.narrative}</p>
        </Card>
      ) : null}
      <h3 className="pt-2 text-[15px] font-semibold text-navy">Evidence checklist</h3>
      <ul className="space-y-2">
        {analysis.evidenceChecklist.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <span>{e.label}</span>
            <Badge tone={e.status === "have" ? "success" : e.status === "missing" ? "warning" : "neutral"}>
              {e.status === "have" ? "You have this" : e.status === "missing" ? "Missing" : "Optional"}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <AppPage>
      <Link href="/cases" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-muted hover:text-navy">
        <ArrowLeft className="size-5" strokeWidth={1.75} />
        Back
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-[24px] font-semibold tracking-tight text-navy">{record.title}</h1>
          <CaseStatusBadge status={record.status} />
        </div>
        <Button variant="ai" onClick={() => setAiOpen(true)}>
          Ask a question
        </Button>
      </div>

      <Tabs className="mt-4" items={TABS} value={tab} onChange={setTab} />

      {tab === "overview" ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl bg-pastel-blue p-5">
            <h2 className="text-[18px] font-semibold text-navy">In simple words</h2>
            <p className="mt-2 text-[16px] leading-relaxed text-ink/90">{analysis.plainLanguageSummary}</p>
          </div>
          {attentionText ? (
            <div className="rounded-2xl bg-pastel-red p-5">
              <h2 className="text-[18px] font-semibold text-navy">Please notice</h2>
              <p className="mt-2 text-[16px] leading-relaxed text-ink/90">{attentionText}</p>
            </div>
          ) : null}
          <div className="ns-card p-5">
            <h2 className="text-[18px] font-semibold text-navy">Important points</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] leading-relaxed text-ink/90">
              {analysis.keyFacts.slice(0, 5).map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-pastel-orange p-5">
            <h2 className="text-[18px] font-semibold text-navy">Do this next</h2>
            <p className="mt-2 text-[16px] leading-relaxed text-ink/90">
              {nextStep?.text ?? "Open What to do for a short list of steps."}
            </p>
            <Button className="mt-4" variant="navy" size="lg" onClick={() => setTab("plan")}>
              See what to do
            </Button>
          </div>
          <details className="ns-card p-5">
            <summary className="cursor-pointer text-[16px] font-semibold text-navy">Your paper and extra detail</summary>
            <div className="mt-4 space-y-4">
              {documentPane}
              {analysis.legalInformation.slice(0, 2).map((item) => (
                <Card key={item.id}>
                  <p className="font-medium text-navy">{item.title}</p>
                  <p className="mt-1 text-[15px] text-ink/90">{item.summary}</p>
                </Card>
              ))}
            </div>
          </details>
        </div>
      ) : null}

      {tab === "plan" ? (
        <div className="mt-6 space-y-5">
          <p className="text-[16px] text-muted">Do these one by one. You do not need to finish all today.</p>
          <ol className="space-y-3">
            {analysis.nextSteps
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((s) => (
                <li key={s.id} className="flex gap-3 rounded-2xl bg-pastel-green p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-sm font-semibold text-white">
                    {s.order}
                  </span>
                  <p className="text-[16px] leading-snug text-ink">{s.text}</p>
                </li>
              ))}
          </ol>
          <h2 className="text-[18px] font-semibold text-navy">Dates</h2>
          <ul className="space-y-3">
            {analysis.deadlines.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[16px] font-medium text-navy">{d.label}</p>
                  <p className="text-[14px] text-muted">{d.date ? formatDate(d.date) : "No date written"}</p>
                </div>
                <Badge tone={urgencyTone(d.urgency)}>{URGENCY_LABEL[d.urgency]}</Badge>
              </li>
            ))}
          </ul>
          <h2 className="text-[18px] font-semibold text-navy">Things we still need</h2>
          <ul className="space-y-3">
            {analysis.missingInformation.map((m) => (
              <li key={m.id} className="rounded-2xl border border-dashed border-border p-4">
                <p className="text-[16px] font-medium text-navy">{m.question}</p>
                <p className="mt-1 text-[14px] text-muted">{m.whyNeeded}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "lawyers" ? (
        <div className="mt-6 space-y-3">
          <p className="text-[16px] text-muted">These are sample people so you can try the app. Free legal aid is also listed below.</p>
          {ranked.map(({ lawyer, match }) => (
            <LawyerCard
              key={lawyer.id}
              lawyer={lawyer}
              match={match}
              onConsult={() => router.push(`/messages?lawyerId=${lawyer.id}`)}
            />
          ))}
          <Link href="/legal-aid" className="ns-card mt-2 block p-5 text-[16px] font-semibold text-primary">
            Free legal aid and official help →
          </Link>
        </div>
      ) : null}

      <Sheet open={aiOpen} onClose={() => setAiOpen(false)} title="Ask a question">
        <AskAiPanel caseId={caseId} />
      </Sheet>
    </AppPage>
  );
}

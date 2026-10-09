"use client";

import { AskAiPanel } from "@/components/assistant/AskAiPanel";
import { CaseStatusBadge } from "@/components/cases/CaseStatusBadge";
import { LawyerCard } from "@/components/lawyers/LawyerCard";
import { AppPage, TabPanel, Tabs } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Alert, Badge, Card, EmptyState, Skeleton } from "@/components/ui/Display";
import { ListenButton } from "@/components/ui/ListenButton";
import { Sheet } from "@/components/ui/Sheet";
import type { CaseAnalysis } from "@/domain/analysis";
import type { CaseRecord } from "@/domain/case";
import type { ProblemDescription, UploadedDocument } from "@/domain/document";
import { daysLeftParts, deadlineState, type DeadlineState } from "@/lib/deadlines";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { sortLawyersByMatch } from "@/lib/lawyerMatch";
import { isHttpsUrl } from "@/lib/safeRedirect";
import { analysisService, caseRepository, documentService, lawyerRepository } from "@/services";
import type { LawyerProfile } from "@/domain/lawyer";
import { ArrowLeft, ExternalLink, Info, LifeBuoy, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TabId = "what" | "do" | "help";

function deadlineTone(state: DeadlineState) {
  if (state === "urgent") return "urgent" as const;
  if (state === "soon") return "warning" as const;
  if (state === "upcoming") return "info" as const;
  return "neutral" as const;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[19px] font-semibold text-navy">{children}</h2>;
}

export default function CaseAnalysisPage() {
  const t = useTranslations("analysis");
  const common = useTranslations("common");
  const tDeadline = useTranslations("deadline");
  const locale = useLocale();
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [analysis, setAnalysis] = useState<CaseAnalysis | null>(null);
  const [doc, setDoc] = useState<UploadedDocument | null>(null);
  const [desc, setDesc] = useState<ProblemDescription | null>(null);
  const [problem, setProblem] = useState<"not_found" | "not_ready" | null>(null);
  const [tab, setTab] = useState<TabId>("what");
  const [aiOpen, setAiOpen] = useState(false);
  const [lawyers, setLawyers] = useState<LawyerProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const c = await caseRepository.getById(caseId);
      if (cancelled) return;
      if (!c.ok) {
        setProblem("not_found");
        return;
      }
      setRecord(c.data);
      const [a, d, p, l] = await Promise.all([
        analysisService.getAnalysis(caseId),
        documentService.getByCaseId(caseId),
        documentService.getDescription(caseId),
        env.advocatesEnabled ? lawyerRepository.list() : null,
      ]);
      if (cancelled) return;
      if (a.ok) setAnalysis(a.data);
      else setProblem("not_ready");
      if (d.ok) setDoc(d.data);
      if (p.ok) setDesc(p.data);
      if (l?.ok) setLawyers(l.data);
    }
    void load().catch(() => {
      if (!cancelled) setProblem("not_ready");
    });
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

  if (problem) {
    return (
      <AppPage>
        <Alert tone="danger" title={t(problem === "not_found" ? "errNotFoundTitle" : "errNotReadyTitle")}>
          {t("errBody")}{" "}
          <Link className="font-semibold underline" href="/cases">
            {t("backToProblems")}
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

  const steps = analysis.nextSteps.slice().sort((a, b) => a.order - b.order);
  // The most serious warnings first.
  const risks = analysis.risks
    .slice()
    .sort((a, b) => Number(b.severity === "serious") - Number(a.severity === "serious"));
  const sources = analysis.sources.filter((s) => isHttpsUrl(s.url));

  function showWhatToDo() {
    setTab("do");
    // The button lives in the panel being hidden, so focus has to follow.
    const tabButton = document.getElementById("case-tab-do");
    tabButton?.focus();
    tabButton?.scrollIntoView({ block: "start" });
  }

  function dateLine(date: string | undefined) {
    const formatted = formatDate(date, locale);
    const left = daysLeftParts(date);
    if (!formatted || !left) return t("noDate");
    return `${formatted} · ${tDeadline(left.key, left.values)}`;
  }

  return (
    <AppPage>
      <Link
        href="/cases"
        className="inline-flex min-h-11 items-center gap-1 text-[16px] font-medium text-muted hover:text-navy"
      >
        <ArrowLeft className="size-5" strokeWidth={1.75} aria-hidden />
        {common("back")}
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-[24px] font-semibold tracking-tight text-navy">{record.title}</h1>
          <CaseStatusBadge status={record.status} />
        </div>
        <Button variant="ai" size="lg" onClick={() => setAiOpen(true)}>
          <MessageCircle className="size-5" strokeWidth={1.75} aria-hidden />
          {t("askQuestion")}
        </Button>
      </div>

      {/* Stays above the explanation on every screen size. */}
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-bg px-3 py-2.5 text-[15px] text-ink md:bg-pastel-blue">
        <Info className="mt-0.5 size-5 shrink-0 text-info" strokeWidth={1.75} aria-hidden />
        {t("notAdvice")}
      </p>

      <Tabs
        className="mt-4"
        idBase="case"
        items={[
          { id: "what", label: t("tabWhat") },
          { id: "do", label: t("tabDo") },
          { id: "help", label: t("tabHelp") },
        ]}
        value={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      <TabPanel idBase="case" id="what" active={tab === "what"} className="mt-6 space-y-4">
        <div className="rounded-2xl bg-pastel-blue p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>{t("simpleWords")}</SectionTitle>
            <ListenButton text={analysis.plainLanguageSummary} />
          </div>
          <p className="mt-2 text-[17px] leading-relaxed text-ink">{analysis.plainLanguageSummary}</p>
        </div>

        {risks.length ? (
          <div className="rounded-2xl bg-pastel-red p-5">
            <SectionTitle>{t("notice")}</SectionTitle>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-[16px] leading-relaxed text-ink">
              {risks.map((risk) => (
                <li key={risk.id} className={risk.severity === "serious" ? "font-semibold" : undefined}>
                  {risk.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="ns-card p-5">
          <SectionTitle>{t("points")}</SectionTitle>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] leading-relaxed text-ink">
            {analysis.keyFacts.map((fact, i) => (
              <li key={i}>{fact}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-pastel-orange p-5">
          <SectionTitle>{t("doNext")}</SectionTitle>
          <p className="mt-2 text-[17px] leading-relaxed text-ink">{steps[0]?.text ?? t("doNextFallback")}</p>
          <Button className="mt-4" variant="navy" size="lg" onClick={showWhatToDo}>
            {t("seeWhatToDo")}
          </Button>
        </div>

        <details className="ns-card p-5">
          <summary className="min-h-11 cursor-pointer text-[17px] font-semibold text-navy">{t("details")}</summary>
          <div className="mt-4 space-y-5">
            {doc?.previewUrl ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-white">
                {/* The sample pictures are small local files, so the image optimiser adds nothing. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doc.previewUrl}
                  alt={t("paperAlt", { name: doc.fileName })}
                  width={800}
                  height={1000}
                  className="h-auto w-full"
                />
              </div>
            ) : doc ? (
              <EmptyState title={doc.fileName} body={t("noPreview")} />
            ) : (
              <EmptyState title={t("noPaperTitle")} body={t("noPaperBody")} />
            )}

            {desc ? (
              <Card>
                <h3 className="text-[16px] font-semibold text-navy">{t("yourStory")}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-ink">{desc.narrative}</p>
              </Card>
            ) : null}

            <div>
              <h3 className="text-[17px] font-semibold text-navy">{t("papersToKeep")}</h3>
              <ul className="mt-2 space-y-2">
                {analysis.evidenceChecklist.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-[16px]"
                  >
                    <span>{e.label}</span>
                    <Badge tone={e.status === "have" ? "success" : e.status === "missing" ? "warning" : "neutral"}>
                      {t(e.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>

            {analysis.clauses.length ? (
              <div>
                <h3 className="text-[17px] font-semibold text-navy">{t("linesTitle")}</h3>
                <ul className="mt-2 space-y-3">
                  {analysis.clauses.map((clause) => (
                    <li key={clause.id} className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-[16px] font-semibold text-navy">{clause.heading}</p>
                      <p className="mt-1 text-[16px] leading-relaxed text-ink">{clause.plainLanguage}</p>
                      {clause.excerpt ? (
                        <p className="mt-2 border-l-4 border-border pl-3 text-[15px] text-muted">
                          <span className="font-semibold">{t("fromPaper")}: </span>
                          <span lang="en">{clause.excerpt}</span>
                        </p>
                      ) : null}
                      {clause.whyItMatters ? (
                        <p className="mt-2 text-[15px] text-ink">
                          <span className="font-semibold">{t("whyItMatters")}: </span>
                          {clause.whyItMatters}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className="text-[17px] font-semibold text-navy">{t("dutiesTitle")}</h3>
              <ul className="mt-2 space-y-2">
                {analysis.obligations.map((item) => (
                  <li key={item.id} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-[16px]">
                    <span className="font-semibold text-navy">{t(`actor_${item.actor}`)}: </span>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-[17px] font-semibold text-navy">{t("goodToKnow")}</h3>
              <ul className="mt-2 space-y-3">
                {analysis.legalInformation.map((item) => (
                  <li key={item.id} className="rounded-xl border border-border bg-surface p-4">
                    <Badge tone="demo">{t("sampleNotChecked")}</Badge>
                    <p className="mt-2 text-[16px] font-semibold text-navy">{item.title}</p>
                    <p className="mt-1 text-[16px] leading-relaxed text-ink">{item.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      </TabPanel>

      <TabPanel idBase="case" id="do" active={tab === "do"} className="mt-6 space-y-5">
        <p className="text-[16px] text-muted">{t("stepsIntro")}</p>
        <ol className="space-y-3">
          {steps.map((s) => (
            <li key={s.id} className="flex gap-3 rounded-2xl bg-pastel-green p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success text-[16px] font-semibold text-white">
                {s.order}
              </span>
              <p className="text-[17px] leading-snug text-ink">{s.text}</p>
            </li>
          ))}
        </ol>

        <SectionTitle>{t("dates")}</SectionTitle>
        <ul className="space-y-3">
          {analysis.deadlines.map((d) => {
            const state = deadlineState(d.date);
            return (
              <li
                key={d.id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-[16px] font-semibold text-navy">{d.label}</p>
                  <p className="text-[16px] text-ink">{dateLine(d.date)}</p>
                  {d.note ? <p className="mt-1 text-[15px] text-muted">{d.note}</p> : null}
                </div>
                <Badge tone={deadlineTone(state)} className="self-start sm:self-center">
                  {tDeadline(state)}
                </Badge>
              </li>
            );
          })}
        </ul>

        {analysis.missingInformation.length ? (
          <>
            <SectionTitle>{t("stillNeed")}</SectionTitle>
            <ul className="space-y-3">
              {analysis.missingInformation.map((m) => (
                <li key={m.id} className="rounded-2xl border border-dashed border-border p-4">
                  <p className="text-[16px] font-semibold text-navy">{m.question}</p>
                  <p className="mt-1 text-[15px] text-muted">{m.whyNeeded}</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {analysis.questionsForLawyer.length ? (
          <>
            <SectionTitle>{t("questionsTitle")}</SectionTitle>
            <ul className="list-disc space-y-2 pl-5 text-[16px] leading-relaxed text-ink">
              {analysis.questionsForLawyer.map((question, i) => (
                <li key={i}>{question}</li>
              ))}
            </ul>
          </>
        ) : null}
      </TabPanel>

      <TabPanel idBase="case" id="help" active={tab === "help"} className="mt-6 space-y-4">
        <p className="text-[17px] text-ink">{t("helpIntro")}</p>
        <Link
          href="/legal-aid"
          className="flex min-h-14 items-center gap-3 rounded-2xl bg-primary px-5 text-[17px] font-semibold text-white hover:bg-primary-hover"
        >
          <LifeBuoy className="size-6 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("helpLink")}
        </Link>

        {sources.length ? (
          <>
            <SectionTitle>{t("sourcesTitle")}</SectionTitle>
            <ul className="space-y-2">
              {sources.map((source) => (
                <li key={source.id}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ns-card flex items-start gap-3 p-4 hover:border-primary/30"
                  >
                    <ExternalLink className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                    <span>
                      <span className="block text-[16px] font-semibold text-navy">{source.label}</span>
                      <span className="mt-1 block text-[15px] text-muted">{source.note}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {/* Advocate listings: switched off, and not translated. See lib/env.ts. */}
        {env.advocatesEnabled
          ? ranked.map(({ lawyer, match }) => (
              <LawyerCard
                key={lawyer.id}
                lawyer={lawyer}
                match={match}
                onConsult={() => router.push(`/messages?lawyerId=${lawyer.id}`)}
              />
            ))
          : null}
      </TabPanel>

      <Sheet open={aiOpen} onClose={() => setAiOpen(false)} title={t("askQuestion")}>
        <AskAiPanel caseId={caseId} />
      </Sheet>
    </AppPage>
  );
}

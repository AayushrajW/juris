import type { CaseAnalysis } from "@/domain/analysis";
import type { CaseRecord } from "@/domain/case";
import type { DemoLocale } from "./locales/types";

const STORY_LIMIT = 280;

/**
 * Cuts long text at the last whole word. Cutting by character count alone can
 * split a Devanagari letter from its vowel sign.
 */
export function shorten(text: string, limit = STORY_LIMIT): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : limit).trimEnd()}…`;
}

/** A placeholder explanation for a case the visitor creates. Nothing is really read. */
export function generateDemoAnalysis(
  record: CaseRecord,
  narrative: string | undefined,
  text: DemoLocale,
): CaseAnalysis {
  const t = text.generated;
  const story = narrative?.trim() ? shorten(narrative.trim()) : t.noStory;
  const place = [record.location?.city, record.location?.state].filter(Boolean).join(", ");

  return {
    caseId: record.id,
    language: text.language,
    overview: {
      oneLine: t.oneLine(record.title, text.matterLabels[record.category]),
      documentOrProblemType: record.source === "description" ? t.typeFromStory : t.typeFromPaper,
      parties: t.parties,
    },
    plainLanguageSummary: t.summary(story),
    keyFacts: [place ? t.factPlace(place) : t.factNoPlace, t.factStartedWith[record.source], t.factNotRead],
    clauses:
      record.source === "description"
        ? []
        : [
            {
              id: `${record.id}-cl-1`,
              heading: t.clauseHeading,
              plainLanguage: t.clausePlain,
              excerpt: t.clauseExcerpt,
            },
          ],
    obligations: [
      { id: `${record.id}-ob-1`, actor: "you", text: t.dutyYou },
      { id: `${record.id}-ob-2`, actor: "unclear", text: t.dutyOther },
    ],
    risks: [{ id: `${record.id}-rk-1`, severity: "attention", text: t.risk }],
    deadlines: [{ id: `${record.id}-dl-1`, label: t.dateLabel, urgency: "none", note: t.dateNote }],
    missingInformation: [
      { id: `${record.id}-mi-1`, question: t.missingQuestion, whyNeeded: t.missingWhy },
    ],
    evidenceChecklist: [
      { id: `${record.id}-ev-1`, label: t.evidenceNotes, status: "have" },
      {
        id: `${record.id}-ev-2`,
        label: t.evidenceOriginal,
        status: record.source === "description" ? "missing" : "have",
      },
    ],
    legalInformation: [
      {
        id: `${record.id}-li-1`,
        title: t.legalTitle,
        summary: t.legalSummary,
        verification: "demo_unverified",
      },
    ],
    sources: [
      {
        id: `${record.id}-src-1`,
        label: t.sourceLegalAid,
        kind: "official_body",
        url: "https://nalsa.gov.in/",
        note: t.sourceNote,
      },
      {
        id: `${record.id}-src-2`,
        label: t.sourceCourts,
        kind: "court_services",
        url: "https://ecourts.gov.in/",
        note: t.sourceNote,
      },
    ],
    nextSteps: [
      { id: `${record.id}-ns-1`, order: 1, kind: "self", text: t.step1 },
      { id: `${record.id}-ns-2`, order: 2, kind: "legal_aid", text: t.step2 },
    ],
    questionsForLawyer: t.questions,
  };
}

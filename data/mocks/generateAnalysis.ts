import type { CaseAnalysis } from "@/domain/analysis";
import type { CaseRecord } from "@/domain/case";

const NOTE =
  "Starting point for official information; not a citation for this demo case.";

export function generateDemoAnalysis(record: CaseRecord, narrative?: string): CaseAnalysis {
  const snippet = narrative?.trim()
    ? narrative.trim().slice(0, 280)
    : "You started this file in the prototype without a long description.";

  return {
    caseId: record.id,
    overview: {
      oneLine: `Demo explanation for “${record.title}” (${record.category.replaceAll("_", " ")}).`,
      documentOrProblemType:
        record.source === "description"
          ? "Problem described in your words (demo)"
          : "Document and/or description (demo)",
      parties: "You and other people named only in your upload or notes",
    },
    plainLanguageSummary: `This is a sample analysis created for the prototype. ${snippet} Juris has not read a real government database and has not asked a model. Treat every heading as a teaching layout, not a legal opinion.`,
    keyFacts: [
      record.location?.city
        ? `Place you entered: ${record.location.city}${record.location.state ? `, ${record.location.state}` : ""}.`
        : "No city was entered.",
      `You filed this as: ${record.source.replaceAll("_", " ")}.`,
      "No live document parsing ran in Phase 1.",
    ],
    clauses:
      record.source === "description"
        ? []
        : [
            {
              id: `${record.id}-cl-1`,
              heading: "Sample clause heading",
              plainLanguage:
                "When a real document is connected later, important sentences will appear here in everyday language.",
              excerpt: "“Demo excerpt — not taken from a live OCR pass.”",
            },
          ],
    obligations: [
      {
        id: `${record.id}-ob-1`,
        actor: "you",
        text: "Keep original papers and a timeline of what happened.",
      },
      {
        id: `${record.id}-ob-2`,
        actor: "unclear",
        text: "The other side’s duties cannot be listed until a real document is analysed.",
      },
    ],
    risks: [
      {
        id: `${record.id}-rk-1`,
        severity: "attention",
        text: "Do not miss dates on any paper you actually received. This demo may not show your real due dates.",
      },
    ],
    deadlines: [
      {
        id: `${record.id}-dl-1`,
        label: "No reliable date extracted",
        urgency: "none",
        note: "Upload clearer papers in a later version that reads files.",
      },
    ],
    missingInformation: [
      {
        id: `${record.id}-mi-1`,
        question: "What official paper started this problem (notice, contract, letter)?",
        whyNeeded: "A sample file cannot invent facts you did not provide.",
      },
    ],
    evidenceChecklist: [
      {
        id: `${record.id}-ev-1`,
        label: "Your notes in Juris",
        status: "have",
      },
      {
        id: `${record.id}-ev-2`,
        label: "Original document with stamps or signatures",
        status: record.source === "description" ? "missing" : "have",
      },
    ],
    legalInformation: [
      {
        id: `${record.id}-li-1`,
        title: "Unverified orientation only",
        summary:
          "Later releases may suggest topics to read about. This card is labelled demo and is not research on your facts.",
        verification: "demo_unverified",
      },
    ],
    sources: [
      {
        id: `${record.id}-src-1`,
        label: "National Legal Services Authority (NALSA)",
        kind: "official_body",
        url: "https://nalsa.gov.in/",
        note: NOTE,
      },
      {
        id: `${record.id}-src-2`,
        label: "eCourts Services",
        kind: "court_services",
        url: "https://ecourts.gov.in/",
        note: NOTE,
      },
    ],
    nextSteps: [
      {
        id: `${record.id}-ns-1`,
        order: 1,
        kind: "self",
        text: "List dates, names, and papers you already have.",
      },
      {
        id: `${record.id}-ns-2`,
        order: 2,
        kind: "legal_aid",
        text: "If you need a person, look up legal aid or a qualified advocate. This app is not that person.",
      },
    ],
    questionsForLawyer: [
      "What is the first paper you would want to see?",
      "Which dates on my papers actually matter?",
      "What should I not do until we have spoken?",
    ],
  };
}

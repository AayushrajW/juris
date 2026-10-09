import type { CaseAnalysis } from "@/domain/analysis";
import type { CaseSource, MatterCategory } from "@/domain/case";
import type { ProblemDescription } from "@/domain/document";

/** Everything the demo says in one language. Every language file has the same shape. */
export interface DemoLocale {
  /** Titles of the three sample cases, by case id. */
  caseTitles: Record<string, string>;
  /** What the sample person wrote about each case, by case id. */
  descriptions: Record<string, Omit<ProblemDescription, "caseId">>;
  /** The sample explanations, by case id. */
  analyses: Record<string, CaseAnalysis>;
  matterLabels: Record<MatterCategory, string>;
  /** Text for a case the visitor creates in the demo. */
  generated: {
    sourceNote: string;
    oneLine: (title: string, matter: string) => string;
    typeFromStory: string;
    typeFromPaper: string;
    parties: string;
    summary: (story: string) => string;
    noStory: string;
    factPlace: (place: string) => string;
    factNoPlace: string;
    factStartedWith: Record<CaseSource, string>;
    factNotRead: string;
    clauseHeading: string;
    clausePlain: string;
    clauseExcerpt: string;
    dutyYou: string;
    dutyOther: string;
    risk: string;
    dateLabel: string;
    dateNote: string;
    missingQuestion: string;
    missingWhy: string;
    evidenceNotes: string;
    evidenceOriginal: string;
    legalTitle: string;
    legalSummary: string;
    sourceLegalAid: string;
    sourceCourts: string;
    step1: string;
    step2: string;
    questions: string[];
  };
  /** Scripted replies of the demo assistant. */
  chat: {
    /** Words in a question that pick each scripted reply. Lower case. */
    keywords: { person: string[]; date: string[]; next: string[] };
    /** Starts every reply, so nobody takes it for a real answer. */
    prefix: string;
    date: (label: string, date: string | null) => string;
    noDate: string;
    person: string;
    nextStep: (step: string) => string;
    defaultStep: string;
    overview: (oneLine: string) => string;
    defaultOverview: string;
  };
}

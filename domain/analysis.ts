import type { CaseId } from "./case";
import type { LanguageCode } from "./user";

export type Urgency = "none" | "upcoming" | "soon" | "urgent";

export interface DeadlineItem {
  id: string;
  label: string;
  date?: string;
  /** As first assessed. Screens work urgency out from `date` (lib/deadlines.ts). */
  urgency: Urgency;
  note?: string;
}

export interface ClauseItem {
  id: string;
  heading: string;
  plainLanguage: string;
  excerpt?: string;
  whyItMatters?: string;
}

export interface ObligationItem {
  id: string;
  actor: "you" | "other_party" | "unclear";
  text: string;
}

export interface RiskItem {
  id: string;
  severity: "attention" | "serious";
  text: string;
}

export interface MissingInfoItem {
  id: string;
  question: string;
  whyNeeded: string;
}

export interface EvidenceItem {
  id: string;
  label: string;
  status: "have" | "missing" | "optional";
}

export interface LegalInfoItem {
  id: string;
  title: string;
  summary: string;
  verification: "demo_unverified";
}

export interface SourceItem {
  id: string;
  label: string;
  kind: "official_body" | "procedure_guide" | "legislation_portal" | "court_services";
  url?: string;
  note: string;
}

export interface NextStepItem {
  id: string;
  order: number;
  text: string;
  kind: "self" | "official" | "legal_aid" | "lawyer";
}

/** How far the reading of a case has got. */
export type AnalysisJobState = "queued" | "reading" | "writing" | "ready" | "failed";

/** Why a reading stopped, so the screen can say what to do about it. */
export interface AnalysisFailure {
  reason: "unreadable" | "unsupported" | "too_long" | "internal";
  /** True when asking again may work without changing anything. */
  retryable: boolean;
}

/**
 * One reading of a case. The case's own status follows its first reading:
 * "processing" while it runs, then "ready" or "needs_more_info", or "error".
 * Reading it again later leaves the status, and the explanation, as they are
 * until the new reading succeeds.
 */
export interface AnalysisJob {
  id: string;
  caseId: CaseId;
  state: AnalysisJobState;
  /** The language the explanation is being written in. */
  language: LanguageCode;
  /** Set when `state` is "failed". */
  failure?: AnalysisFailure;
  startedAt: string;
  /** When `state` last changed. */
  updatedAt: string;
}

/** A date from one of the person's explanations that has not passed yet. */
export interface UpcomingDeadline {
  caseId: CaseId;
  caseTitle: string;
  label: string;
  date: string;
}

export interface CaseAnalysis {
  caseId: CaseId;
  /** The language it was written in. It stays in that language until the case is read again. */
  language: LanguageCode;
  overview: {
    oneLine: string;
    documentOrProblemType: string;
    parties?: string;
  };
  plainLanguageSummary: string;
  keyFacts: string[];
  clauses: ClauseItem[];
  obligations: ObligationItem[];
  risks: RiskItem[];
  deadlines: DeadlineItem[];
  missingInformation: MissingInfoItem[];
  evidenceChecklist: EvidenceItem[];
  legalInformation: LegalInfoItem[];
  sources: SourceItem[];
  nextSteps: NextStepItem[];
  questionsForLawyer: string[];
}

import type { CaseId } from "./case";

export type Urgency = "none" | "upcoming" | "soon" | "urgent";

export interface DeadlineItem {
  id: string;
  label: string;
  date?: string;
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

export interface CaseAnalysis {
  caseId: CaseId;
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

export const ACTOR_LABEL: Record<ObligationItem["actor"], string> = {
  you: "You",
  other_party: "The other party",
  unclear: "Unclear who",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  none: "No date given",
  upcoming: "Upcoming",
  soon: "Soon",
  urgent: "Urgent",
};

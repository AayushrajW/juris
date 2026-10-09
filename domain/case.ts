import type { UserId } from "./user";

export type CaseId = string;

export type CaseStatus =
  | "draft"
  | "processing"
  | "ready"
  | "needs_more_info"
  | "error";

export type CaseSource = "document" | "description" | "document_and_description";

export type MatterCategory =
  | "consumer"
  | "tenancy"
  | "employment"
  | "family"
  | "criminal_complaint"
  | "property"
  | "documents_id"
  | "other";

export interface CaseLocation {
  city?: string;
  state?: string;
}

export interface CaseRecord {
  id: CaseId;
  citizenId: UserId;
  title: string;
  category: MatterCategory;
  source: CaseSource;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  location?: CaseLocation;
  /** True for sample cases and for anything made while the app runs on sample data. */
  isDemo: boolean;
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  draft: "Draft",
  processing: "Reading your papers",
  ready: "Explanation ready",
  needs_more_info: "Needs more detail",
  error: "Could not finish",
};

export function isOpenCase(status: CaseStatus): boolean {
  return status === "ready" || status === "needs_more_info";
}

/** The shortest story the service will read, and the longest name a case may have. */
export const MIN_STORY_LENGTH = 20;
export const MAX_TITLE_LENGTH = 120;

import type { CaseId } from "./case";

export type DocumentId = string;

export interface UploadedDocument {
  id: DocumentId;
  caseId: CaseId;
  fileName: string;
  mimeType: string;
  byteSize: number;
  kind: "pdf" | "image" | "other";
  previewUrl?: string;
  uploadStatus: "local_only" | "simulated";
  /** When it was added. */
  createdAt: string;
}

/** A paper together with the name of the case it belongs to, for lists across cases. */
export interface DocumentListing extends UploadedDocument {
  caseTitle: string;
}

export interface ProblemDescription {
  caseId: CaseId;
  narrative: string;
  whatHappened?: string;
  whenHappened?: string;
  whoInvolved?: string;
  whatOutcomeWanted?: string;
}

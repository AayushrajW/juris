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
}

export interface ProblemDescription {
  caseId: CaseId;
  narrative: string;
  whatHappened?: string;
  whenHappened?: string;
  whoInvolved?: string;
  whatOutcomeWanted?: string;
}

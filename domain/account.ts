import type { CaseAnalysis } from "./analysis";
import type { CaseRecord } from "./case";
import type { ChatMessage } from "./chat";
import type { ProblemDescription, UploadedDocument } from "./document";
import type { User } from "./user";

/** Everything held about one person, in a form they can save and read. */
export interface AccountExport {
  exportedAt: string;
  user: User;
  cases: {
    record: CaseRecord;
    story: ProblemDescription | null;
    documents: UploadedDocument[];
    /** The explanation, once there is one. */
    analysis: CaseAnalysis | null;
    questions: ChatMessage[];
  }[];
}

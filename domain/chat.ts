import type { CaseId } from "./case";
import type { LanguageCode } from "./user";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  caseId: CaseId;
  role: ChatRole;
  content: string;
  createdAt: string;
  isDemo?: boolean;
  /** The language a reply was written in, so it can be read aloud and announced correctly. */
  language?: LanguageCode;
}

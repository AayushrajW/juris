import type { CaseId } from "./case";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  caseId: CaseId;
  role: ChatRole;
  content: string;
  createdAt: string;
  isDemo?: boolean;
}

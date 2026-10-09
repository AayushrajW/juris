import type { LawyerId } from "./lawyer";

export type ThreadRole = "user" | "lawyer";

export interface LawyerMessage {
  id: string;
  lawyerId: LawyerId;
  role: ThreadRole;
  content: string;
  createdAt: string;
}

export interface LawyerThread {
  lawyerId: LawyerId;
  unreadCount: number;
  messages: LawyerMessage[];
}

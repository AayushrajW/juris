import type { ChatMessage } from "@/domain/chat";
import type { ChatService } from "@/services/types";
import { loadStore, updateStore } from "./store";

function replyFor(caseId: string, content: string): string {
  const lower = content.toLowerCase();
  const analysis = loadStore().analyses[caseId];
  if (lower.includes("deadline") || lower.includes("date")) {
    const first = analysis?.deadlines[0];
    return `Demo reply — not from a live model. ${
      first
        ? `The sample file lists “${first.label}”${first.date ? ` (${first.date})` : ""}. Confirm any real paper in your hand.`
        : "This demo case does not list a date."
    } Juris is not a lawyer.`;
  }
  if (lower.includes("lawyer") || lower.includes("advocate")) {
    return "Demo reply — not from a live model. If you want a person, use Find an advocate in this prototype (sample profiles only) or legal aid through official channels. Juris does not represent you.";
  }
  if (lower.includes("next") || lower.includes("do ")) {
    const step = analysis?.nextSteps[0];
    return `Demo reply — not from a live model. A first sample step is: ${step?.text ?? "collect your papers."} This is not legal advice.`;
  }
  const summary = analysis?.overview.oneLine ?? "This demo case has a short overview on the analysis page.";
  return `Demo reply — not from a live model. ${summary} Ask about dates, papers, or next steps if you want those sections restated. Juris is not a lawyer and does not give legal advice.`;
}

export const mockChatService: ChatService = {
  async list(caseId) {
    return { ok: true, data: loadStore().chats[caseId] ?? [] };
  },
  async send(caseId, content) {
    const trimmed = content.trim();
    if (!trimmed) {
      return { ok: false, code: "invalid", message: "Type a question first." };
    }
    const now = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      caseId,
      role: "user",
      content: trimmed,
      createdAt: now,
    };
    const assistantMsg: ChatMessage = {
      id: `m-${Date.now()}-a`,
      caseId,
      role: "assistant",
      content: replyFor(caseId, trimmed),
      createdAt: now,
      isDemo: true,
    };
    let next: ChatMessage[] = [];
    updateStore((s) => {
      next = [...(s.chats[caseId] ?? []), userMsg, assistantMsg];
      return { ...s, chats: { ...s.chats, [caseId]: next } };
    });
    return { ok: true, data: next };
  },
};

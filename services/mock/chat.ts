import type { CaseAnalysis } from "@/domain/analysis";
import type { ChatMessage } from "@/domain/chat";
import { nextDeadline } from "@/lib/deadlines";
import { formatDate } from "@/lib/format";
import type { ChatService } from "@/services/types";
import { mockAnalysisService } from "./analysis";
import { currentLocale, demoText } from "./locale";
import { loadStore, updateStore, type DemoReplyKind, type StoredChatMessage } from "./store";

function mentions(question: string, words: string[]) {
  return words.some((word) => question.includes(word));
}

/** Picks one of the scripted replies from the words in the question. No model is involved. */
function replyKind(content: string): DemoReplyKind {
  const { keywords } = demoText().chat;
  const question = content.toLowerCase();
  if (mentions(question, keywords.person)) return "person";
  if (mentions(question, keywords.date)) return "date";
  if (mentions(question, keywords.next)) return "next";
  return "overview";
}

function replyText(kind: DemoReplyKind, analysis: CaseAnalysis | null): string {
  const t = demoText().chat;
  let body: string;
  if (kind === "person") {
    body = t.person;
  } else if (kind === "date") {
    const first = analysis ? (nextDeadline(analysis.deadlines) ?? analysis.deadlines[0]) : null;
    body = first ? t.date(first.label, formatDate(first.date, currentLocale())) : t.noDate;
  } else if (kind === "next") {
    const step = analysis?.nextSteps.slice().sort((a, b) => a.order - b.order)[0];
    body = t.nextStep(step?.text ?? t.defaultStep);
  } else {
    body = t.overview(analysis?.overview.oneLine ?? t.defaultOverview);
  }
  return `${t.prefix} ${body}`;
}

/**
 * Replies are written out when they are read, not when they are stored, so
 * they follow the page's language and the sample dates stay current.
 */
async function render(caseId: string, stored: StoredChatMessage[]): Promise<ChatMessage[]> {
  const result = await mockAnalysisService.getAnalysis(caseId);
  const analysis = result.ok ? result.data : null;
  return stored.map(({ demoReply, ...message }) =>
    demoReply ? { ...message, content: replyText(demoReply, analysis) } : message,
  );
}

export const mockChatService: ChatService = {
  async list(caseId) {
    return { ok: true, data: await render(caseId, loadStore().chats[caseId] ?? []) };
  },
  async send(caseId, content) {
    const trimmed = content.trim();
    if (!trimmed) {
      return { ok: false, code: "invalid", message: "Type a question first." };
    }
    const now = new Date().toISOString();
    const userMsg: StoredChatMessage = {
      id: `m-${crypto.randomUUID()}`,
      caseId,
      role: "user",
      content: trimmed,
      createdAt: now,
    };
    const assistantMsg: StoredChatMessage = {
      id: `m-${crypto.randomUUID()}`,
      caseId,
      role: "assistant",
      content: "",
      createdAt: now,
      isDemo: true,
      demoReply: replyKind(trimmed),
    };
    let next: StoredChatMessage[] = [];
    updateStore((s) => {
      next = [...(s.chats[caseId] ?? []), userMsg, assistantMsg];
      return { ...s, chats: { ...s.chats, [caseId]: next } };
    });
    return { ok: true, data: await render(caseId, next) };
  },
};

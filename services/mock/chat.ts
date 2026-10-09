import { demoLocale } from "@/data/mocks/locales";
import type { CaseRecord } from "@/domain/case";
import type { ChatMessage } from "@/domain/chat";
import { fail, ok } from "@/domain/result";
import type { LanguageCode } from "@/domain/user";
import { nextDeadline } from "@/lib/deadlines";
import { formatDate } from "@/lib/format";
import { newId } from "@/lib/ids";
import type { ChatService } from "@/services/types";
import { explanationIn, finishedExplanation } from "./analysis";
import { currentLocale } from "./locale";
import { ownedCase, paginateFromEnd } from "./session";
import { loadStore, updateStore, type DemoReplyKind, type StoredChatMessage } from "./store";

const MAX_QUESTION_LENGTH = 2000;

function mentions(question: string, words: string[]) {
  return words.some((word) => question.includes(word));
}

/** Picks one of the scripted replies from the words in the question. No model is involved. */
function replyKind(content: string, language: LanguageCode): DemoReplyKind {
  const { keywords } = demoLocale(language).chat;
  const question = content.toLowerCase();
  if (mentions(question, keywords.person)) return "person";
  if (mentions(question, keywords.date)) return "date";
  if (mentions(question, keywords.next)) return "next";
  return "overview";
}

function replyText(kind: DemoReplyKind, record: CaseRecord, language: LanguageCode): string {
  const t = demoLocale(language).chat;
  const explanation = explanationIn(record, language);
  let body: string;
  if (kind === "person") {
    body = t.person;
  } else if (kind === "date") {
    const first = nextDeadline(explanation.deadlines) ?? explanation.deadlines[0];
    body = first ? t.date(first.label, formatDate(first.date, language)) : t.noDate;
  } else if (kind === "next") {
    const step = explanation.nextSteps.slice().sort((a, b) => a.order - b.order)[0];
    body = t.nextStep(step?.text ?? t.defaultStep);
  } else {
    body = t.overview(explanation.overview.oneLine || t.defaultOverview);
  }
  return `${t.prefix} ${body}`;
}

/**
 * A reply keeps the language it was given in, as a real one would. Its words
 * are still put together when it is read, so the sample dates stay current.
 */
function render(record: CaseRecord, stored: StoredChatMessage[]): ChatMessage[] {
  return stored.map((m) => {
    const language = m.language ?? currentLocale();
    return {
      id: m.id,
      caseId: m.caseId,
      role: m.role,
      content: m.demoReply ? replyText(m.demoReply, record, language) : m.content,
      createdAt: m.createdAt,
      isDemo: m.isDemo,
      ...(m.demoReply ? { language } : {}),
    };
  });
}

export const mockChatService: ChatService = {
  async list(caseId, params) {
    const found = ownedCase(caseId);
    if (!found.ok) return found;
    const page = paginateFromEnd(loadStore().chats[caseId] ?? [], params, (m) => m.id);
    if (!page.ok) return page;
    return ok({ ...page.data, items: render(found.data, page.data.items) });
  },
  async send(caseId, content, options) {
    const found = ownedCase(caseId);
    if (!found.ok) return found;
    const trimmed = content.trim();
    if (!trimmed) return fail("invalid", { reason: "empty", field: "content" });
    if (trimmed.length > MAX_QUESTION_LENGTH) return fail("invalid", { reason: "too_long", field: "content" });

    const thread = loadStore().chats[caseId] ?? [];
    // A retry of a request that already went through gets the first answer back.
    const earlier = options?.requestId
      ? thread.findIndex((m) => m.requestId === options.requestId)
      : -1;
    if (earlier >= 0) {
      if (thread[earlier].content !== trimmed) return fail("conflict", { reason: "request_reused" });
      return ok(render(found.data, thread.slice(earlier, earlier + 2)));
    }
    // Questions are answered from the explanation, so there has to be one.
    const explained = finishedExplanation(found.data);
    if (!explained.ok) return explained;

    const language = options?.language ?? currentLocale();
    const now = new Date().toISOString();
    const question: StoredChatMessage = {
      id: `m-${newId()}`,
      caseId,
      role: "user",
      content: trimmed,
      createdAt: now,
      requestId: options?.requestId,
    };
    const reply: StoredChatMessage = {
      id: `m-${newId()}`,
      caseId,
      role: "assistant",
      content: "",
      createdAt: now,
      isDemo: true,
      demoReply: replyKind(trimmed, language),
      language,
    };
    updateStore((s) => ({
      ...s,
      chats: { ...s.chats, [caseId]: [...(s.chats[caseId] ?? []), question, reply] },
    }));
    return ok(render(found.data, [question, reply]));
  },
};

import { fail, ok } from "@/domain/result";
import type { LawyerMessage } from "@/domain/thread";
import { newId } from "@/lib/ids";
import type { LawyerChatService } from "@/services/types";
import { signedIn } from "./session";
import { loadStore, updateStore } from "./store";

const DEMO_REPLY =
  "Demo reply from a sample advocate profile. This prototype does not send messages to a real lawyer. Juris is not a law firm.";

export const mockLawyerChatService: LawyerChatService = {
  async listThreads() {
    const who = signedIn();
    if (!who.ok) return who;
    return ok(loadStore().lawyerThreads);
  },
  async list(lawyerId) {
    const who = signedIn();
    if (!who.ok) return who;
    const thread = loadStore().lawyerThreads.find((t) => t.lawyerId === lawyerId);
    return ok(thread?.messages ?? []);
  },
  async send(lawyerId, content) {
    const who = signedIn();
    if (!who.ok) return who;
    const trimmed = content.trim();
    if (!trimmed) return fail("invalid", { reason: "empty", field: "content" });
    const now = new Date().toISOString();
    const userMsg = {
      id: `lm-${newId()}`,
      lawyerId,
      role: "user" as const,
      content: trimmed,
      createdAt: now,
    };
    const lawyerMsg = {
      id: `lm-${newId()}`,
      lawyerId,
      role: "lawyer" as const,
      content: DEMO_REPLY,
      createdAt: now,
    };
    let next: LawyerMessage[] = [];
    updateStore((s) => {
      const threads = [...s.lawyerThreads];
      const idx = threads.findIndex((t) => t.lawyerId === lawyerId);
      if (idx === -1) {
        next = [userMsg, lawyerMsg];
        threads.unshift({ lawyerId, unreadCount: 0, messages: next });
      } else {
        next = [...threads[idx].messages, userMsg, lawyerMsg];
        threads[idx] = { ...threads[idx], unreadCount: 0, messages: next };
      }
      return { ...s, lawyerThreads: threads };
    });
    return ok(next);
  },
  async markRead(lawyerId) {
    const who = signedIn();
    if (!who.ok) return who;
    const next = updateStore((s) => ({
      ...s,
      lawyerThreads: s.lawyerThreads.map((t) =>
        t.lawyerId === lawyerId ? { ...t, unreadCount: 0 } : t,
      ),
    }));
    return ok(next.lawyerThreads);
  },
};

import type { LawyerChatService } from "@/services/types";
import type { LawyerMessage } from "@/domain/thread";
import { loadStore, updateStore } from "./store";

const DEMO_REPLY =
  "Demo reply from a sample advocate profile. This prototype does not send messages to a real lawyer. Juris is not a law firm.";

export const mockLawyerChatService: LawyerChatService = {
  async listThreads() {
    return { ok: true, data: loadStore().lawyerThreads };
  },
  async list(lawyerId) {
    const thread = loadStore().lawyerThreads.find((t) => t.lawyerId === lawyerId);
    return { ok: true, data: thread?.messages ?? [] };
  },
  async send(lawyerId, content) {
    const trimmed = content.trim();
    if (!trimmed) {
      return { ok: false, code: "invalid", message: "Type a message first." };
    }
    const now = new Date().toISOString();
    const userMsg = {
      id: `lm-${Date.now()}`,
      lawyerId,
      role: "user" as const,
      content: trimmed,
      createdAt: now,
    };
    const lawyerMsg = {
      id: `lm-${Date.now()}-r`,
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
    return { ok: true, data: next };
  },
  async markRead(lawyerId) {
    const next = updateStore((s) => ({
      ...s,
      lawyerThreads: s.lawyerThreads.map((t) =>
        t.lawyerId === lawyerId ? { ...t, unreadCount: 0 } : t,
      ),
    }));
    return { ok: true, data: next.lawyerThreads };
  },
};

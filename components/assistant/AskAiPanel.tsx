"use client";

import { ChatInput, MessageBubble } from "@/components/chat/ChatPrimitives";
import { Alert } from "@/components/ui/Display";
import type { ChatMessage } from "@/domain/chat";
import { chatService } from "@/services";
import { Bot } from "lucide-react";
import { useEffect, useState } from "react";

const SUGGESTIONS = [
  "What dates should I watch?",
  "What should I do next?",
  "When should I speak to an advocate?",
];

export function AskAiPanel({ caseId, seedQuestion }: { caseId: string; seedQuestion?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void chatService.list(caseId).then((result) => {
      if (result.ok) setMessages(result.data);
    });
  }, [caseId]);

  useEffect(() => {
    if (seedQuestion) void send(seedQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedQuestion]);

  async function send(content: string) {
    setError(null);
    const result = await chatService.send(caseId, content);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessages(result.data);
    setText("");
  }

  return (
    <div className="flex h-full min-h-[28rem] flex-col">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-pastel-orange text-ai">
          <Bot className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-navy">AI Legal Assistant</h2>
          <p className="text-[11px] text-muted">Demo replies only · not a lawyer</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3" aria-live="polite">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">
            Ask about this case. Answers are scripted from the sample analysis and labelled as demo.
          </p>
        ) : null}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            align={m.role === "user" ? "right" : "left"}
            tone={m.role === "user" ? "accent" : "ai"}
          >
            {m.content}
          </MessageBubble>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pb-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-navy hover:bg-bg"
            onClick={() => void send(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {error ? (
        <p className="pb-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <ChatInput value={text} onChange={setText} onSubmit={() => void send(text)} placeholder="Ask about this case" />
      <div className="mt-3">
        <Alert tone="info" title="Not legal advice">
          Every assistant message in Phase 1 is a demo. Do not treat it as an opinion of an advocate.
        </Alert>
      </div>
    </div>
  );
}

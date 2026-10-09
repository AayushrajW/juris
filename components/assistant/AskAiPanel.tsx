"use client";

import { ChatInput, MessageBubble } from "@/components/chat/ChatPrimitives";
import { Alert } from "@/components/ui/Display";
import type { ChatMessage } from "@/domain/chat";
import { chatService } from "@/services";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "use-intl";
import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = ["suggest1", "suggest2", "suggest3"] as const;

export function AskAiPanel({ caseId }: { caseId: string }) {
  const t = useTranslations("assistant");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void chatService.list(caseId).then((result) => {
      if (!cancelled && result.ok) setMessages(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  // Keep the newest reply in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function send(content: string) {
    if (sending) return;
    if (!content.trim()) {
      setError(t("errEmpty"));
      return;
    }
    setError(null);
    setSending(true);
    try {
      const result = await chatService.send(caseId, content);
      if (!result.ok) {
        setError(t("errSend"));
        return;
      }
      setMessages(result.data);
      setText("");
    } catch {
      setError(t("errSend"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-[28rem] flex-col">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-pastel-orange text-ai">
          <MessageCircle className="size-6" strokeWidth={1.75} aria-hidden />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold text-navy">{t("panelTitle")}</h2>
          <p className="text-[14px] text-muted">{t("panelSub")}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3" role="log" aria-live="polite">
        {messages.length === 0 ? <p className="text-[16px] text-muted">{t("empty")}</p> : null}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            align={m.role === "user" ? "right" : "left"}
            tone={m.role === "user" ? "accent" : "ai"}
          >
            {m.content}
          </MessageBubble>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex flex-wrap gap-2 pb-3">
        {SUGGESTIONS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={sending}
            className="min-h-11 rounded-full border border-border bg-surface px-4 text-[15px] font-medium text-navy hover:bg-bg disabled:opacity-50"
            onClick={() => void send(t(key))}
          >
            {t(key)}
          </button>
        ))}
      </div>
      {error ? (
        <p className="pb-2 text-[15px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <ChatInput value={text} onChange={setText} onSubmit={() => void send(text)} disabled={sending} />
      <div className="mt-3">
        <Alert tone="info" title={t("notAdviceTitle")}>
          {t("notAdviceBody")}
        </Alert>
      </div>
    </div>
  );
}

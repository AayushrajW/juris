"use client";

import { ChatInput, MessageBubble } from "@/components/chat/ChatPrimitives";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Display";
import type { ChatMessage } from "@/domain/chat";
import type { ServiceError } from "@/domain/result";
import { useErrorText } from "@/hooks/useErrorText";
import { newId } from "@/lib/ids";
import { chatService } from "@/services";
import { MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = ["suggest1", "suggest2", "suggest3"] as const;

export function AskAiPanel({ caseId }: { caseId: string }) {
  const t = useTranslations("assistant");
  const common = useTranslations("common");
  const locale = useLocale();
  const errorText = useErrorText();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Where the messages before the ones on screen start, if there are any.
  const [earlier, setEarlier] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  // The thread is only called empty once it has really been read.
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<ServiceError | null>(null);
  const [loadTry, setLoadTry] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const followNewest = useRef(true);
  // The question being sent keeps one id until it goes through, so that trying
  // again after a lost reply is never asked, or answered, twice.
  const unsent = useRef<{ content: string; requestId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void chatService.list(caseId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setLoadError(null);
      setLoaded(true);
      setMessages(result.data.items);
      setEarlier(result.data.nextCursor);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId, loadTry]);

  // Keep the newest reply in view, except when older messages were just added above.
  useEffect(() => {
    if (followNewest.current) endRef.current?.scrollIntoView({ block: "nearest" });
    followNewest.current = true;
  }, [messages]);

  async function showEarlier() {
    if (!earlier || loadingEarlier) return;
    setLoadingEarlier(true);
    const result = await chatService.list(caseId, { cursor: earlier });
    setLoadingEarlier(false);
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    followNewest.current = false;
    setMessages((current) => [...result.data.items.filter((m) => !current.some((c) => c.id === m.id)), ...current]);
    setEarlier(result.data.nextCursor);
  }

  async function send(content: string) {
    if (sending) return;
    const question = content.trim();
    if (!question) {
      setError(t("errEmpty"));
      return;
    }
    setError(null);
    setSending(true);
    if (unsent.current?.content !== question) {
      unsent.current = { content: question, requestId: newId() };
    }
    const result = await chatService.send(caseId, question, {
      requestId: unsent.current.requestId,
      language: locale,
    });
    setSending(false);
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    unsent.current = null;
    setMessages((current) => [...current, ...result.data.filter((m) => !current.some((c) => c.id === m.id))]);
    setText("");
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
        {loadError ? (
          <div className="space-y-3">
            <Alert tone="danger" title={common("couldNotLoad")}>
              {errorText(loadError)}
            </Alert>
            <Button variant="secondary" onClick={() => setLoadTry((n) => n + 1)}>
              {common("tryAgain")}
            </Button>
          </div>
        ) : null}
        {loaded && messages.length === 0 ? <p className="text-[16px] text-muted">{t("empty")}</p> : null}
        {earlier ? (
          <button
            type="button"
            disabled={loadingEarlier}
            className="mx-auto block min-h-11 rounded-full border border-border bg-surface px-4 text-[15px] font-medium text-navy hover:bg-bg disabled:opacity-50"
            onClick={() => void showEarlier()}
          >
            {t("showEarlier")}
          </button>
        ) : null}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            align={m.role === "user" ? "right" : "left"}
            tone={m.role === "user" ? "accent" : "ai"}
            lang={m.language}
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

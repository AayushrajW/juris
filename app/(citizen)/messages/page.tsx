"use client";

import { Avatar } from "@/components/brand/Avatar";
import { ChatInput, MessageBubble } from "@/components/chat/ChatPrimitives";
import { AppPage } from "@/components/ui/AppKit";
import { EmptyState, Skeleton } from "@/components/ui/Display";
import type { LawyerProfile } from "@/domain/lawyer";
import type { LawyerMessage, LawyerThread } from "@/domain/thread";
import { lawyerChatService, lawyerRepository } from "@/services";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  CreditCard,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Phone,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function MessagesInner() {
  const router = useRouter();
  const search = useSearchParams();
  const requested = search.get("lawyerId");
  const [threads, setThreads] = useState<LawyerThread[] | null>(null);
  const [lawyers, setLawyers] = useState<LawyerProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(requested);
  const [messages, setMessages] = useState<LawyerMessage[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    void lawyerRepository.list().then((r) => {
      if (r.ok) setLawyers(r.data);
    });
    void lawyerChatService.listThreads().then((r) => {
      if (r.ok) {
        setThreads(r.data);
        const first = requested ?? r.data[0]?.lawyerId ?? null;
        setActiveId(first);
      }
    });
  }, [requested]);

  useEffect(() => {
    if (!activeId) return;
    void lawyerChatService.list(activeId).then((r) => {
      if (r.ok) setMessages(r.data);
    });
    void lawyerChatService.markRead(activeId);
  }, [activeId]);

  const lawyer = lawyers.find((l) => l.id === activeId);
  const byId = useMemo(() => Object.fromEntries(lawyers.map((l) => [l.id, l])), [lawyers]);

  async function send() {
    if (!activeId) return;
    const result = await lawyerChatService.send(activeId, text);
    if (result.ok) {
      setMessages(result.data);
      setText("");
      const threadsResult = await lawyerChatService.listThreads();
      if (threadsResult.ok) setThreads(threadsResult.data);
    }
  }

  if (threads === null) {
    return (
      <AppPage>
        <Skeleton className="h-80" />
      </AppPage>
    );
  }

  if (!activeId) {
    return (
      <AppPage>
        <h1 className="text-[22px] font-semibold text-navy">Messages</h1>
        <EmptyState
          title="No conversations yet"
          body="Request a consultation from a lawyer profile to start a demo chat."
          action={
            <Link href="/lawyers" className="text-sm font-semibold text-primary">
              Find a lawyer →
            </Link>
          }
        />
      </AppPage>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col md:min-h-[calc(100vh-6rem)]">
      <div className="hidden border-b border-border bg-surface md:grid md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="border-r border-border px-4 py-4">
          <h1 className="text-[16px] font-semibold text-navy">Messages</h1>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={lawyer?.fullName} />
            <div>
              <p className="flex items-center gap-1 text-[14px] font-semibold text-navy">
                {lawyer?.fullName ?? "Advocate"}
                {lawyer?.verified ? <BadgeCheck className="size-4 text-info" /> : null}
              </p>
              <p className="text-[11px] text-success">Online</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-muted">
            <Phone className="size-4" />
            <Video className="size-4" />
            <MoreHorizontal className="size-4" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 md:grid md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className={`${activeId && threads.length ? "hidden md:block" : "block"} border-r border-border bg-surface`}>
          <div className="px-4 py-4 md:hidden">
            <h1 className="text-[20px] font-semibold text-navy">Messages</h1>
          </div>
          <ul>
            {threads.map((t) => {
              const person = byId[t.lawyerId];
              const last = t.messages[t.messages.length - 1];
              return (
                <li key={t.lawyerId}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(t.lawyerId);
                      router.replace(`/messages?lawyerId=${t.lawyerId}`);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                      t.lawyerId === activeId ? "bg-pastel-purple" : "hover:bg-bg"
                    }`}
                  >
                    <Avatar name={person?.fullName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-navy">
                        {person?.fullName ?? t.lawyerId}
                      </span>
                      <span className="block truncate text-[11px] text-muted">{last?.content}</span>
                    </span>
                    {t.unreadCount > 0 ? (
                      <span className="rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white">
                        {t.unreadCount}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-bg">
          <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-3 py-3 md:hidden">
            <button type="button" onClick={() => setActiveId(threads[0]?.lawyerId ?? null)} aria-label="Back">
              <ArrowLeft className="size-5 text-navy" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar name={lawyer?.fullName} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-navy">{lawyer?.fullName}</p>
                <p className="text-[11px] text-success">Online</p>
              </div>
            </div>
            <div className="flex gap-2 text-muted">
              <Phone className="size-4" />
              <Video className="size-4" />
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} align={m.role === "user" ? "right" : "left"} tone={m.role === "user" ? "accent" : "plain"}>
                {m.content}
              </MessageBubble>
            ))}
          </div>

          <div className="border-t border-border bg-surface px-4 py-3">
            <ChatInput value={text} onChange={setText} onSubmit={() => void send()} />
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {(
                [
                  { Icon: FolderOpen, label: "Case Details", href: "/cases" },
                  { Icon: FileText, label: "Documents", href: "/documents" },
                  { Icon: Calendar, label: "Schedule Call", href: "/lawyers" },
                  { Icon: CreditCard, label: "Payments", href: "/settings" },
                ] as const
              ).map((item) => (
                <Link key={item.label} href={item.href} className="rounded-xl px-1 py-2 text-muted hover:bg-bg">
                  <item.Icon className="mx-auto size-4" strokeWidth={1.75} />
                  <span className="mt-1 block text-[10px] font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesInner />
    </Suspense>
  );
}

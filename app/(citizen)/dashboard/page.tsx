"use client";

import { CaseCard } from "@/components/cases/CaseCard";
import { Button } from "@/components/ui/Button";
import { ActionCard, AppPage } from "@/components/ui/AppKit";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Display";
import { useSession } from "@/hooks/useSession";
import type { CaseRecord } from "@/domain/case";
import { formatDate, greetingForNow } from "@/lib/format";
import { analysisService, caseRepository } from "@/services";
import { Bot, Camera, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { user, ready } = useSession();
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<{ label: string; date?: string; caseId: string; title: string } | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const result = await caseRepository.listByCitizen(user.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCases(result.data);
      const analyses = await Promise.all(result.data.map((c) => analysisService.getAnalysis(c.id)));
      const upcoming: { date: string; label: string; caseId: string; title: string }[] = [];
      analyses.forEach((a, i) => {
        if (!a.ok) return;
        const record = result.data[i];
        a.data.deadlines.forEach((d) => {
          if (d.date && (d.urgency === "urgent" || d.urgency === "soon" || d.urgency === "upcoming")) {
            upcoming.push({ date: d.date, label: d.label, caseId: record.id, title: record.title });
          }
        });
      });
      upcoming.sort((a, b) => a.date.localeCompare(b.date));
      const first = upcoming[0];
      setDeadline(first ? { label: first.label, date: first.date, caseId: first.caseId, title: first.title } : null);
    })();
  }, [user]);

  const recent = cases?.slice(0, 3) ?? [];

  if (!ready) {
    return (
      <AppPage>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-4 h-28 w-full" />
      </AppPage>
    );
  }

  return (
    <AppPage>
      <h1 className="text-[26px] font-semibold tracking-tight text-navy">
        {greetingForNow(user?.displayName)}
      </h1>
      <p className="mt-1 text-[16px] text-muted">What do you want to do?</p>

      {deadline ? (
        <Link
          href={`/cases/${deadline.caseId}`}
          className="mt-5 flex items-start gap-3 rounded-2xl bg-pastel-orange p-4"
        >
          <span className="mt-0.5 text-[15px] font-bold text-warning">!</span>
          <span className="min-w-0">
            <span className="block text-[16px] font-semibold text-navy">A date is coming</span>
            <span className="mt-1 block text-[14px] leading-snug text-ink/85">
              {deadline.label}
              {deadline.date ? ` — ${formatDate(deadline.date)}` : ""}. Tap to see what to do.
            </span>
          </span>
        </Link>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ActionCard
          tone="blue"
          href="/cases/new?mode=document"
          title="Photo of a paper"
          description="We read it in simple words."
          cta="Upload"
          icon={<Camera className="size-6" strokeWidth={1.75} />}
        />
        <ActionCard
          tone="green"
          href="/cases/new?mode=description"
          title="Tell your story"
          description="Say what happened. We show next steps."
          cta="Start"
          icon={<MessageCircle className="size-6" strokeWidth={1.75} />}
        />
        <ActionCard
          tone="orange"
          href="/assistant"
          title="Ask a question"
          description="A helper answers in easy language."
          cta="Ask"
          icon={<Bot className="size-6" strokeWidth={1.75} />}
        />
      </div>

      <p className="mt-4 text-center text-[15px]">
        <Link href="/lawyers" className="font-semibold text-primary">
          Need a person to talk to? Find help →
        </Link>
      </p>

      {error ? (
        <div className="mt-6">
          <Alert tone="danger" title="Could not load">
            {error}
          </Alert>
        </div>
      ) : null}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-navy">Your problems</h2>
          <Link href="/cases" className="text-[15px] font-semibold text-primary">
            See all
          </Link>
        </div>
        <div className="mt-3 grid gap-3">
          {cases === null && !error ? <Skeleton className="h-16" /> : null}
          {cases && recent.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              body="Start with a photo of a paper, or tell your story."
              action={
                <Link href="/cases/new">
                  <Button size="lg">Start</Button>
                </Link>
              }
            />
          ) : null}
          {recent.map((record) => (
            <CaseCard key={record.id} record={record} />
          ))}
        </div>
      </section>
    </AppPage>
  );
}

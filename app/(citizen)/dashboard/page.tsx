"use client";

import { CaseCard } from "@/components/cases/CaseCard";
import { ActionCard, AppPage } from "@/components/ui/AppKit";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Display";
import { useSession } from "@/hooks/useSession";
import type { UpcomingDeadline } from "@/domain/analysis";
import type { CaseRecord } from "@/domain/case";
import { HELP_HREF } from "@/lib/constants";
import { daysLeftParts } from "@/lib/deadlines";
import { firstName, formatDate } from "@/lib/format";
import { caseService } from "@/services";
import { Camera, CircleAlert, LifeBuoy, MessageCircle, Mic } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

/** How many of the person's problems the home screen shows. The rest are one tap away. */
const RECENT = 3;

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const common = useTranslations("common");
  const tDeadline = useTranslations("deadline");
  const locale = useLocale();
  const { user, ready } = useSession();
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [deadline, setDeadline] = useState<UpcomingDeadline | null>(null);

  // Two small requests, whatever the number of problems: the newest few, and the nearest date.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [list, dates] = await Promise.all([
        caseService.list({ limit: RECENT }),
        caseService.upcomingDeadlines({ limit: 1 }),
      ]);
      if (cancelled) return;
      if (list.ok) setCases(list.data.items);
      else setFailed(true);
      if (dates.ok) setDeadline(dates.data[0] ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recent = cases ?? [];

  if (!ready) {
    return (
      <AppPage>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-4 h-28 w-full" />
      </AppPage>
    );
  }

  const name = firstName(user?.displayName);
  const left = deadline ? daysLeftParts(deadline.date) : null;

  return (
    <AppPage>
      <h1 className="text-[26px] font-semibold tracking-tight text-navy">
        {name ? t("hello", { name }) : t("helloNoName")}
      </h1>
      <p className="mt-1 text-[17px] text-muted">{t("question")}</p>

      {deadline && left ? (
        <Link
          href={`/cases/${deadline.caseId}`}
          className="mt-5 flex items-start gap-3 rounded-2xl bg-pastel-orange p-4"
        >
          <CircleAlert className="mt-0.5 size-6 shrink-0 text-warning" strokeWidth={2} aria-hidden />
          <span className="min-w-0">
            <span className="block text-[17px] font-semibold text-navy">{t("dateComing")}</span>
            <span className="mt-1 block text-[15px] leading-snug text-ink/90">
              {t("dateComingBody", {
                label: deadline.label,
                date: formatDate(deadline.date, locale) ?? "",
                left: tDeadline(left.key, left.values),
              })}
            </span>
          </span>
        </Link>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ActionCard
          tone="blue"
          href="/cases/new?mode=document"
          title={t("photoTitle")}
          description={t("photoBody")}
          cta={t("photoCta")}
          icon={<Camera className="size-7" strokeWidth={1.75} />}
        />
        <ActionCard
          tone="green"
          href="/cases/new?mode=description"
          title={t("storyTitle")}
          description={t("storyBody")}
          cta={t("storyCta")}
          icon={<Mic className="size-7" strokeWidth={1.75} />}
        />
        <ActionCard
          tone="orange"
          href="/assistant"
          title={t("askTitle")}
          description={t("askBody")}
          cta={t("askCta")}
          icon={<MessageCircle className="size-7" strokeWidth={1.75} />}
        />
      </div>

      <Link
        href={HELP_HREF}
        className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-surface px-4 text-center text-[16px] font-semibold text-primary"
      >
        <LifeBuoy className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
        {t("needPerson")}
      </Link>

      {failed ? (
        <div className="mt-6">
          <Alert tone="danger" title={common("couldNotLoad")} />
        </div>
      ) : null}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-semibold text-navy">{t("yourProblems")}</h2>
          <Link href="/cases" className="inline-flex min-h-11 items-center text-[16px] font-semibold text-primary">
            {t("seeAll")}
          </Link>
        </div>
        <div className="mt-2 grid gap-3">
          {cases === null && !failed ? <Skeleton className="h-16" /> : null}
          {cases && recent.length === 0 ? (
            <EmptyState
              title={t("emptyTitle")}
              body={t("emptyBody")}
              action={
                <Link
                  href="/cases/new"
                  className="inline-flex min-h-14 items-center rounded-xl bg-primary px-6 text-[17px] font-semibold text-white"
                >
                  {t("emptyCta")}
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

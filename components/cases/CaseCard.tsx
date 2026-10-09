"use client";

import { CaseStatusBadge } from "@/components/cases/CaseStatusBadge";
import { isOpenCase, type CaseRecord } from "@/domain/case";
import { Briefcase, FileText, Landmark, Receipt, Shield, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useTranslations } from "use-intl";

const icons = {
  tenancy: FileText,
  consumer: Receipt,
  employment: Briefcase,
  family: Users,
  criminal_complaint: Shield,
  property: Landmark,
  documents_id: FileText,
  other: FileText,
} as const;

const iconTone = {
  tenancy: "bg-pastel-blue text-info",
  consumer: "bg-pastel-orange text-warning",
  employment: "bg-pastel-blue text-primary",
  family: "bg-pastel-green text-success",
  criminal_complaint: "bg-pastel-red text-danger",
  property: "bg-pastel-blue text-info",
  documents_id: "bg-bg text-navy",
  other: "bg-bg text-navy",
} as const;

export function CaseCard({ record }: { record: CaseRecord }) {
  // Until a problem has its explanation, the progress page is where it lives.
  const href = isOpenCase(record.status) ? `/cases/${record.id}` : `/cases/${record.id}/processing`;
  const Icon = icons[record.category];
  const t = useTranslations("cases");
  return (
    <Link
      href={href}
      className="ns-card flex min-h-16 items-center gap-3 px-4 py-4 transition-colors hover:border-primary/30"
    >
      <span
        className={cn(
          "inline-flex size-12 shrink-0 items-center justify-center rounded-2xl",
          iconTone[record.category],
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold leading-snug text-navy">{record.title}</span>
        <span className="mt-0.5 block text-[14px] text-muted">{t("tapToOpen")}</span>
      </span>
      <CaseStatusBadge status={record.status} />
    </Link>
  );
}

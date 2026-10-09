"use client";

import { CASE_STATUS_TONE } from "@/lib/caseUi";
import { Badge } from "@/components/ui/Display";
import type { CaseStatus } from "@/domain/case";
import { useTranslations } from "use-intl";

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const t = useTranslations("status");
  return <Badge tone={CASE_STATUS_TONE[status]}>{t(status)}</Badge>;
}

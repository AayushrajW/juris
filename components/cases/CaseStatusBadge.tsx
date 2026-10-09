import { CASE_STATUS_UI } from "@/lib/caseUi";
import { Badge } from "@/components/ui/Display";
import type { CaseStatus } from "@/domain/case";

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const ui = CASE_STATUS_UI[status];
  return <Badge tone={ui.tone}>{ui.label}</Badge>;
}

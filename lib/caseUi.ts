import type { CaseStatus } from "@/domain/case";

export const CASE_STATUS_UI: Record<
  CaseStatus,
  { label: string; tone: "info" | "success" | "warning" | "urgent" | "neutral" }
> = {
  draft: { label: "Draft", tone: "neutral" },
  processing: { label: "Reading…", tone: "info" },
  ready: { label: "Ready", tone: "success" },
  needs_more_info: { label: "Needs you", tone: "warning" },
  error: { label: "Could not finish", tone: "urgent" },
};

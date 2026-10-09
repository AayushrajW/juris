import type { CaseStatus } from "@/domain/case";

/** Badge colour for each status. The words come from the "status" messages. */
export const CASE_STATUS_TONE: Record<CaseStatus, "info" | "success" | "warning" | "urgent" | "neutral"> = {
  draft: "neutral",
  processing: "info",
  ready: "success",
  needs_more_info: "warning",
  error: "urgent",
};

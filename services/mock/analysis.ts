import type { AnalysisService } from "@/services/types";
import { mockCaseRepository } from "./cases";
import { loadStore } from "./store";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockAnalysisService: AnalysisService = {
  async getAnalysis(caseId) {
    const analysis = loadStore().analyses[caseId];
    if (!analysis) {
      return { ok: false, code: "not_found", message: "No explanation is ready for this case yet." };
    }
    return { ok: true, data: analysis };
  },
  async startProcessing(caseId) {
    await wait(2200);
    const status = await mockCaseRepository.updateStatus(caseId, "ready");
    if (!status.ok) return status;
    return this.getAnalysis(caseId);
  },
};

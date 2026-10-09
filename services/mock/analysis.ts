import { generateDemoAnalysis } from "@/data/mocks/generateAnalysis";
import type { AnalysisService } from "@/services/types";
import { mockCaseRepository } from "./cases";
import { demoText } from "./locale";
import { loadStore } from "./store";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockAnalysisService: AnalysisService = {
  async getAnalysis(caseId) {
    const text = demoText();
    const sample = text.analyses[caseId];
    if (sample) return { ok: true, data: sample };

    const store = loadStore();
    const record = store.cases.find((c) => c.id === caseId);
    if (!record) {
      return { ok: false, code: "not_found", message: "No explanation is ready for this case yet." };
    }
    const story = store.descriptions.find((d) => d.caseId === caseId)?.narrative;
    return { ok: true, data: generateDemoAnalysis(record, story, text) };
  },
  async startProcessing(caseId) {
    await wait(2200);
    const status = await mockCaseRepository.updateStatus(caseId, "ready");
    if (!status.ok) return status;
    return this.getAnalysis(caseId);
  },
};

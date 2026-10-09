import { generateDemoAnalysis } from "@/data/mocks/generateAnalysis";
import { demoLocale, isDemoCase } from "@/data/mocks/locales";
import type { AnalysisJob, CaseAnalysis } from "@/domain/analysis";
import type { CaseRecord } from "@/domain/case";
import { fail, ok, type Result } from "@/domain/result";
import type { LanguageCode } from "@/domain/user";
import { newId } from "@/lib/ids";
import type { AnalysisService } from "@/services/types";
import { describeJob } from "./jobs";
import { currentLocale } from "./locale";
import { ownedCase, signedIn } from "./session";
import { loadStore, updateStore, type StoredJob } from "./store";

const isFinished = (record: CaseRecord) => record.status === "ready" || record.status === "needs_more_info";

/** The latest reading of a case, or null if there has never been one. */
export function latestJob(record: CaseRecord): AnalysisJob | null {
  const stored = loadStore().jobs[record.id];
  if (stored) return describeJob(record.id, stored);
  // The sample cases arrive already explained, in whichever language the page shows.
  if (!isFinished(record)) return null;
  return {
    id: `job-${record.id}`,
    caseId: record.id,
    state: "ready",
    language: currentLocale(),
    startedAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/** Builds the explanation in one language. Nothing is really read. */
export function explanationIn(record: CaseRecord, language: LanguageCode): CaseAnalysis {
  const text = demoLocale(language);
  const sample = text.analyses[record.id];
  if (sample) return { ...sample, language };
  const story = loadStore().descriptions.find((d) => d.caseId === record.id)?.narrative;
  return generateDemoAnalysis(record, story, text);
}

/**
 * The latest finished explanation of a case the caller has already checked
 * belongs to the person. Questions, upcoming dates and the export all go
 * through here, so they agree about whether there is one.
 */
export function finishedExplanation(record: CaseRecord): Result<CaseAnalysis> {
  const job = latestJob(record);
  if (!job) return fail("conflict", { reason: "never_started" });
  if (job.state === "ready") return ok(explanationIn(record, job.language));
  // A later reading that is still running, or that failed, leaves the earlier one in place.
  const kept = loadStore().jobs[record.id]?.kept;
  if (kept) return ok(explanationIn(record, kept));
  return fail("conflict", { reason: job.state === "failed" ? "reading_failed" : "not_ready" });
}

function hasSomethingToRead(record: CaseRecord) {
  const store = loadStore();
  return (
    store.documents.some((d) => d.caseId === record.id) ||
    store.descriptions.some((d) => d.caseId === record.id) ||
    isDemoCase(record.id)
  );
}

export const mockAnalysisService: AnalysisService = {
  async start(caseId, options) {
    const who = signedIn();
    if (!who.ok) return who;
    const found = ownedCase(caseId);
    if (!found.ok) return found;

    const latest = latestJob(found.data);
    const again = latest?.state === "failed" || (latest?.state === "ready" && options?.rerun);
    if (latest && !again) return ok(latest);
    if (!hasSomethingToRead(found.data)) return fail("conflict", { reason: "nothing_to_read" });

    // What the person already has stays theirs until this reading succeeds.
    const kept = latest?.state === "ready" ? latest.language : loadStore().jobs[caseId]?.kept;
    const startedAt = new Date().toISOString();
    const job: StoredJob = {
      id: `job-${newId()}`,
      startedAt,
      language: options?.language ?? who.data.preferredLanguage,
      ...(kept ? { kept } : {}),
    };
    updateStore((s) => ({
      ...s,
      jobs: { ...s.jobs, [caseId]: job },
      cases: kept
        ? s.cases
        : s.cases.map((c) => (c.id === caseId ? { ...c, status: "processing", updatedAt: startedAt } : c)),
    }));
    return ok(describeJob(caseId, job));
  },
  async status(caseId) {
    const found = ownedCase(caseId);
    return found.ok ? ok(latestJob(found.data)) : found;
  },
  async get(caseId) {
    const found = ownedCase(caseId);
    return found.ok ? finishedExplanation(found.data) : found;
  },
};

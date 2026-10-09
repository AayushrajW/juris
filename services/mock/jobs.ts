import type { AnalysisJob, AnalysisJobState } from "@/domain/analysis";
import type { CaseId } from "@/domain/case";
import { currentFault } from "./faults";
import { loadStore, saveStore, type StoredJob } from "./store";

// How long each pretend stage lasts, counted from when the reading was asked for.
const QUEUED_MS = 700;
const READING_MS = 1400;
const WRITING_MS = 2200;

/**
 * Finishes every reading whose time is up, and moves its case on with it.
 * Every service runs this before it looks at anything, so a case is finished
 * whether or not a page was open to watch.
 */
export function settleJobs() {
  const store = loadStore();
  const now = Date.now();
  const finishedAt = new Map<CaseId, string>();
  for (const [caseId, job] of Object.entries(store.jobs)) {
    const due = Date.parse(job.startedAt) + WRITING_MS;
    if (!job.outcome && now >= due) finishedAt.set(caseId, new Date(due).toISOString());
  }
  if (finishedAt.size === 0) return;

  const outcome = currentFault() === "job_failed" ? "failed" : "ready";
  const jobs = { ...store.jobs };
  for (const caseId of finishedAt.keys()) jobs[caseId] = { ...jobs[caseId], outcome };
  saveStore({
    ...store,
    jobs,
    cases: store.cases.map((c) => {
      const updatedAt = finishedAt.get(c.id);
      if (!updatedAt) return c;
      // Reading a case again changes nothing about it unless the new reading succeeds.
      if (jobs[c.id].kept) return outcome === "ready" ? { ...c, updatedAt } : c;
      return { ...c, status: outcome === "ready" ? "ready" : "error", updatedAt };
    }),
  });
}

/** The job as it stands now. Progress comes from the clock, not from a timer in a page. */
export function describeJob(caseId: CaseId, job: StoredJob): AnalysisJob {
  const started = Date.parse(job.startedAt);
  const elapsed = Date.now() - started;
  const state: AnalysisJobState =
    job.outcome ?? (elapsed < QUEUED_MS ? "queued" : elapsed < READING_MS ? "reading" : "writing");
  const changedAfter =
    state === "queued" ? 0 : state === "reading" ? QUEUED_MS : state === "writing" ? READING_MS : WRITING_MS;
  return {
    id: job.id,
    caseId,
    state,
    language: job.language,
    ...(state === "failed" ? { failure: { reason: "internal" as const, retryable: true } } : {}),
    startedAt: job.startedAt,
    updatedAt: new Date(started + changedAfter).toISOString(),
  };
}

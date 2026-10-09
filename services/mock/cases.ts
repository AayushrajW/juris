import { DEMO_CASES } from "@/data/mocks/cases";
import { isDemoCase } from "@/data/mocks/locales";
import type { UpcomingDeadline } from "@/domain/analysis";
import { MAX_TITLE_LENGTH, MIN_STORY_LENGTH, type CaseId, type CaseRecord } from "@/domain/case";
import { fail, ok, type Result } from "@/domain/result";
import { MATTER_CATEGORIES } from "@/lib/constants";
import { daysUntil } from "@/lib/format";
import { newId } from "@/lib/ids";
import type { CaseService, CreateCaseInput } from "@/services/types";
import { finishedExplanation } from "./analysis";
import { demoText } from "./locale";
import { newestFirst, ownedCase, paginate, signedIn } from "./session";
import { loadStore, updateStore } from "./store";

const DEFAULT_DEADLINES = 3;
const MAX_DEADLINES = 20;

const SEED_TITLES = new Map(DEMO_CASES.map((c) => [c.id, c.title]));

function nowIso() {
  return new Date().toISOString();
}

/** Sample cases show their title in the language of the page, until the person gives one a name of their own. */
export function localized(record: CaseRecord): CaseRecord {
  const title = demoText().caseTitles[record.id];
  return title && record.title === SEED_TITLES.get(record.id) ? { ...record, title } : record;
}

function cleanTitle(title: string): Result<string> {
  const trimmed = title.trim();
  if (!trimmed) return fail("invalid", { reason: "empty", field: "title" });
  if (trimmed.length > MAX_TITLE_LENGTH) return fail("invalid", { reason: "too_long", field: "title" });
  return ok(trimmed);
}

const knownCategory = (value: unknown) => MATTER_CATEGORIES.some((c) => c === value);

/** When it was made, then its id: an order that nothing a person does later can change. */
const orderKey = (record: CaseRecord) => `${record.createdAt}|${record.id}`;

/** The person's own cases, newest first. */
export function ownCases(userId: string): CaseRecord[] {
  return newestFirst(
    loadStore().cases.filter((c) => c.citizenId === userId),
    orderKey,
  );
}

export const mockCaseService: CaseService = {
  async list(params) {
    const who = signedIn();
    if (!who.ok) return who;
    const wanted = params?.status === undefined ? null : [params.status].flat();
    const rows = ownCases(who.data.id).filter((c) => !wanted || wanted.includes(c.status));
    const page = paginate(rows, params, orderKey);
    return page.ok ? ok({ ...page.data, items: page.data.items.map(localized) }) : page;
  },
  async get(caseId: CaseId) {
    const found = ownedCase(caseId);
    return found.ok ? ok(localized(found.data)) : found;
  },
  async getStory(caseId: CaseId) {
    const found = ownedCase(caseId);
    if (!found.ok) return found;
    if (isDemoCase(caseId)) {
      const sample = demoText().descriptions[caseId];
      return ok(sample ? { ...sample, caseId } : null);
    }
    return ok(loadStore().descriptions.find((d) => d.caseId === caseId) ?? null);
  },
  async create(input: CreateCaseInput, options) {
    const who = signedIn();
    if (!who.ok) return who;
    const title = cleanTitle(input.title);
    if (!title.ok) return title;
    if (!knownCategory(input.category)) return fail("invalid", { field: "category" });
    const tellsStory = input.source !== "document";
    if (tellsStory && (input.story?.narrative.trim().length ?? 0) < MIN_STORY_LENGTH) {
      return fail("invalid", { reason: "too_short", field: "story" });
    }
    const city = input.city?.trim() || undefined;
    const state = input.state?.trim() || undefined;
    const story = tellsStory && input.story ? input.story : null;

    // A second tap, or a retry after a lost reply, gets the case the first
    // request made. The same id with something else in it is a mistake.
    const requestId = options?.requestId;
    const print = JSON.stringify([title.data, input.category, input.source, city, state, story]);
    const earlier = requestId ? loadStore().requests[requestId] : undefined;
    const made = earlier ? ownedCase(earlier.made) : null;
    if (earlier && made?.ok) {
      return earlier.print === print ? ok(localized(made.data)) : fail("conflict", { reason: "request_reused" });
    }

    const id = `case-${newId()}`;
    const createdAt = nowIso();
    const record: CaseRecord = {
      id,
      citizenId: who.data.id,
      title: title.data,
      category: input.category,
      source: input.source,
      // Nothing has been read yet. AnalysisService.start moves it on.
      status: "draft",
      createdAt,
      updatedAt: createdAt,
      location: { city, state },
      isDemo: true,
    };
    updateStore((s) => ({
      ...s,
      cases: [record, ...s.cases],
      descriptions: story ? [...s.descriptions, { ...story, caseId: id }] : s.descriptions,
      requests: requestId ? { ...s.requests, [requestId]: { made: id, print } } : s.requests,
    }));
    return ok(record);
  },
  async update(caseId, changes) {
    const found = ownedCase(caseId);
    if (!found.ok) return found;
    const title = changes.title === undefined ? null : cleanTitle(changes.title);
    if (title && !title.ok) return title;
    if (changes.category !== undefined && !knownCategory(changes.category)) {
      return fail("invalid", { field: "category" });
    }
    const before = found.data;
    const place = (next: string | undefined, current: string | undefined) =>
      next === undefined ? current : next.trim() || undefined;
    const updated: CaseRecord = {
      ...before,
      title: title?.data ?? before.title,
      category: changes.category ?? before.category,
      location: {
        city: place(changes.city, before.location?.city),
        state: place(changes.state, before.location?.state),
      },
      updatedAt: nowIso(),
    };
    updateStore((s) => ({ ...s, cases: s.cases.map((c) => (c.id === caseId ? updated : c)) }));
    return ok(localized(updated));
  },
  async remove(caseId) {
    const found = ownedCase(caseId);
    if (!found.ok) return found;
    updateStore((s) => {
      const chats = { ...s.chats };
      const jobs = { ...s.jobs };
      delete chats[caseId];
      delete jobs[caseId];
      // Everything the case owned goes with it, down to the record of the requests that made it.
      const gone = new Set([caseId, ...s.documents.filter((d) => d.caseId === caseId).map((d) => d.id)]);
      return {
        ...s,
        cases: s.cases.filter((c) => c.id !== caseId),
        documents: s.documents.filter((d) => d.caseId !== caseId),
        descriptions: s.descriptions.filter((d) => d.caseId !== caseId),
        chats,
        jobs,
        requests: Object.fromEntries(Object.entries(s.requests).filter(([, r]) => !gone.has(r.made))),
      };
    });
    return ok(null);
  },
  async upcomingDeadlines(params) {
    const who = signedIn();
    if (!who.ok) return who;
    const asked = Number.isFinite(params?.limit) ? Math.trunc(params?.limit as number) : DEFAULT_DEADLINES;
    const limit = Math.min(Math.max(asked, 1), MAX_DEADLINES);

    const coming: UpcomingDeadline[] = [];
    for (const record of ownCases(who.data.id)) {
      const explanation = finishedExplanation(record);
      if (!explanation.ok) continue;
      for (const deadline of explanation.data.deadlines) {
        const days = daysUntil(deadline.date);
        if (!deadline.date || days === null || days < 0) continue;
        coming.push({
          caseId: record.id,
          caseTitle: localized(record).title,
          label: deadline.label,
          date: deadline.date,
        });
      }
    }
    coming.sort((a, b) => a.date.localeCompare(b.date));
    return ok(coming.slice(0, limit));
  },
};

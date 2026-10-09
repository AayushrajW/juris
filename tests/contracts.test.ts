import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TITLE_LENGTH, MIN_STORY_LENGTH, type CaseRecord } from "@/domain/case";
import type { ChatMessage } from "@/domain/chat";
import type { ErrorCode, ErrorReason, Page, Result } from "@/domain/result";
import type { User } from "@/domain/user";
import { MAX_FILE_BYTES } from "@/lib/files";
import {
  accountService,
  analysisService,
  authService,
  caseService,
  chatService,
  documentService,
} from "@/services";
import { setFault } from "@/services/mock/faults";
import { clearStore, updateStore } from "@/services/mock/store";
import type {
  AccountService,
  AnalysisService,
  AuthService,
  CaseService,
  ChatService,
  CreateCaseInput,
  DocumentService,
} from "@/services/types";

/*
 * What every implementation of services/types.ts must do. The tests only use
 * the public service objects, so the same suite can be pointed at the real
 * backend later: call describeContracts again with its services and a reset.
 */

interface Services {
  auth: AuthService;
  cases: CaseService;
  documents: DocumentService;
  analysis: AnalysisService;
  chat: ChatService;
  account: AccountService;
}

/** What the suite needs from an implementation that the contract itself gives no way to do. */
interface Backstage {
  /** Empties everything, so each test starts clean. */
  reset(): void | Promise<void>;
  /** Makes readings fail, or work again. */
  failReadings(on: boolean): void | Promise<void>;
  /**
   * Puts a finished case with a paper and a question, belonging to somebody
   * else, beside the data of the person who is signed in, and returns its ids.
   */
  seedForeignCase(): Promise<{ caseId: string; documentId: string }>;
}

// Written as a record so that adding a code to ErrorCode breaks the build here.
const KNOWN_CODES: Record<ErrorCode, true> = {
  unauthenticated: true,
  forbidden: true,
  not_found: true,
  invalid: true,
  conflict: true,
  too_large: true,
  rate_limited: true,
  quota_exceeded: true,
  unavailable: true,
};

const SAMPLE_CASE_IDS = ["case-consumer", "case-employment", "case-tenancy"];
const ASHA = { email: "asha.contract@example.org", displayName: "Asha" };
const BHARAT = { email: "bharat.contract@example.org", displayName: "Bharat" };
const STORY = "My landlord has not returned my deposit for three months.";
const NOWHERE = "case-does-not-exist";

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got "${result.error.code}" (${result.error.detail ?? "no detail"})`);
  return result.data;
}

/** Every failure in the suite goes through here, so the shape of a failure is checked everywhere. */
function expectFailure(result: Result<unknown>, code: ErrorCode, field?: string, reason?: ErrorReason) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(Object.keys(KNOWN_CODES)).toContain(result.error.code);
  // Screens translate the code. Wording from a service must have nowhere to travel.
  expect(result).not.toHaveProperty("message");
  expect(result.error).not.toHaveProperty("message");
  expect(result).not.toHaveProperty("data");
  expect(result.error.code).toBe(code);
  if (field !== undefined) expect(result.error.field).toBe(field);
  if (reason !== undefined) expect(result.error.reason).toBe(reason);
}

function storyCase(title = "Deposit not returned"): CreateCaseInput {
  return { title, category: "tenancy", source: "description", story: { narrative: STORY } };
}

function pdf(name = "notice.pdf", bytes = 1200) {
  return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
}

function png(name = "photo.png", bytes = 640) {
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

/** Looks like a File of any size without holding that many bytes. */
function fileOfSize(name: string, type: string, size: number): File {
  return { name, type, size } as unknown as File;
}

/** Moves the clock on, so that two things never happen in the same millisecond. */
function wait(ms: number) {
  vi.advanceTimersByTime(ms);
}

function describeContracts(name: string, services: Services, backstage: Backstage) {
  const { auth, cases, documents, analysis, chat, account } = services;

  async function signInAs(who: { email: string; displayName?: string }): Promise<User> {
    return unwrap(await auth.signIn(who));
  }

  async function newCase(title?: string): Promise<CaseRecord> {
    wait(1000);
    return unwrap(await cases.create(storyCase(title)));
  }

  /** A case of the person's own whose explanation is ready, so that questions can be asked about it. */
  async function readCase(title?: string): Promise<CaseRecord> {
    const made = await newCase(title);
    unwrap(await analysis.start(made.id));
    wait(60_000);
    return unwrap(await cases.get(made.id));
  }

  async function allCases(): Promise<CaseRecord[]> {
    const page = unwrap(await cases.list({ limit: 50 }));
    expect(page.nextCursor).toBeNull();
    return page.items;
  }

  /** Follows nextCursor to the end, failing if it never ends. */
  async function walk<T>(fetchPage: (cursor?: string) => Promise<Result<Page<T>>>, limit: number) {
    const pages: T[][] = [];
    let cursor: string | undefined;
    for (let turn = 0; turn < 50; turn += 1) {
      const page = unwrap(await fetchPage(cursor));
      expect(page.items.length).toBeLessThanOrEqual(limit);
      pages.push(page.items);
      if (page.nextCursor === null) return pages;
      expect(typeof page.nextCursor).toBe("string");
      expect(page.items.length).toBeGreaterThan(0);
      cursor = page.nextCursor;
    }
    throw new Error("paging did not end");
  }

  /** Asks for the status every 100 ms until the job is ready, and returns each state once, in order. */
  async function pollUntilReady(caseId: string) {
    const seen: string[] = [];
    for (let turn = 0; turn < 600; turn += 1) {
      const job = unwrap(await analysis.status(caseId));
      if (!job) throw new Error("the case has no job");
      if (seen[seen.length - 1] !== job.state) seen.push(job.state);
      if (job.state === "ready" || job.state === "failed") return seen;
      wait(100);
    }
    throw new Error(`job never finished: ${seen.join(" -> ")}`);
  }

  describe(`service contracts: ${name}`, () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      // Later than the sample cases, so that anything made in a test is the newest.
      vi.setSystemTime(new Date("2026-10-09T10:00:00.000Z"));
      await backstage.reset();
    });

    afterEach(async () => {
      await backstage.failReadings(false);
      vi.useRealTimers();
    });

    describe("sessions", () => {
      it("has no session before anyone signs in", async () => {
        expect(await auth.getSession()).toBeNull();
      });

      it("refuses every case, paper, explanation, question and account request when nobody is signed in", async () => {
        const id = SAMPLE_CASE_IDS[0];
        const attempts: Record<string, Result<unknown>> = {
          "cases.list": await cases.list(),
          "cases.get": await cases.get(id),
          "cases.getStory": await cases.getStory(id),
          "cases.create": await cases.create(storyCase()),
          "cases.update": await cases.update(id, { title: "Another name" }),
          "cases.remove": await cases.remove(id),
          "cases.upcomingDeadlines": await cases.upcomingDeadlines(),
          "documents.list": await documents.list(id),
          "documents.listAll": await documents.listAll(),
          "documents.upload": await documents.upload(id, pdf()),
          "documents.remove": await documents.remove("doc-tenancy"),
          "analysis.start": await analysis.start(id),
          "analysis.status": await analysis.status(id),
          "analysis.get": await analysis.get(id),
          "chat.list": await chat.list(id),
          "chat.send": await chat.send(id, "What should I do next?"),
          "account.updateProfile": await account.updateProfile({ displayName: "Someone" }),
          "account.exportData": await account.exportData(),
          "account.deleteAccount": await account.deleteAccount(),
        };
        for (const [method, result] of Object.entries(attempts)) {
          expect(result, method).toMatchObject({ ok: false, error: { code: "unauthenticated" } });
          expectFailure(result, "unauthenticated");
        }
      });

      it("checks who is asking before it checks what was sent", async () => {
        // Otherwise a stranger could learn the rules, or which ids exist, without signing in.
        expectFailure(await cases.create({ ...storyCase(), title: "" }), "unauthenticated");
        expectFailure(await cases.get(NOWHERE), "unauthenticated");
        expectFailure(await chat.send(SAMPLE_CASE_IDS[0], "   "), "unauthenticated");
        expectFailure(await documents.upload(SAMPLE_CASE_IDS[0], pdf("virus.exe")), "unauthenticated");
      });

      it.each(["not-an-email", "asha@", "@example.org", "asha@example", "asha kale@example.org", ""])(
        "signIn rejects the malformed email %j",
        async (email) => {
          expectFailure(await auth.signIn({ email }), "invalid", "email");
          expect(await auth.getSession()).toBeNull();
        },
      );

      it("signUp rejects a malformed email in the same way", async () => {
        expectFailure(await auth.signUp({ email: "not-an-email" }), "invalid", "email");
        expect(await auth.getSession()).toBeNull();
      });

      it("signIn returns a citizen with the email and name that were given", async () => {
        const user = unwrap(await auth.signIn(ASHA));
        expect(user.id).toEqual(expect.any(String));
        expect(user.id.length).toBeGreaterThan(0);
        expect(user.role).toBe("citizen");
        expect(user.email).toBe(ASHA.email);
        expect(user.displayName).toBe(ASHA.displayName);
        expect(["mr", "hi", "en"]).toContain(user.preferredLanguage);
      });

      it("signUp then getSession returns the same user", async () => {
        const user = unwrap(await auth.signUp(ASHA));
        expect(await auth.getSession()).toEqual(user);
      });

      it("signIn then getSession returns the same user", async () => {
        const user = unwrap(await auth.signIn(ASHA));
        expect(await auth.getSession()).toEqual(user);
      });

      it("signOut ends the session", async () => {
        await signInAs(ASHA);
        await auth.signOut();
        expect(await auth.getSession()).toBeNull();
        expectFailure(await cases.list(), "unauthenticated");
        expectFailure(await account.exportData(), "unauthenticated");
      });

      it("gives two different emails two different user ids", async () => {
        const asha = await signInAs(ASHA);
        await auth.signOut();
        const bharat = await signInAs(BHARAT);
        expect(bharat.id).not.toBe(asha.id);
      });

      it("gives the same email the same user id every time", async () => {
        const first = await signInAs(ASHA);
        await auth.signOut();
        const second = await signInAs(ASHA);
        expect(second.id).toBe(first.id);
      });
    });

    describe("sample data", () => {
      it("lists the three sample cases, newest first, as the signed-in person's own", async () => {
        const user = await signInAs(ASHA);
        const page = unwrap(await cases.list());

        expect(page.items).toHaveLength(3);
        expect(page.nextCursor).toBeNull();
        expect(page.items.map((c) => c.id).sort()).toEqual(SAMPLE_CASE_IDS);
        for (const record of page.items) {
          expect(record.citizenId).toBe(user.id);
          expect(record.isDemo).toBe(true);
          expect(record.title.length).toBeGreaterThan(0);
        }
        const stamps = page.items.map((c) => c.createdAt);
        expect(stamps).toEqual([...stamps].sort().reverse());
      });

      it("hands the sample cases to whoever signs in next", async () => {
        await signInAs(ASHA);
        await auth.signOut();
        const bharat = await signInAs(BHARAT);
        const items = await allCases();
        expect(items).toHaveLength(3);
        expect(items.every((c) => c.citizenId === bharat.id)).toBe(true);
      });

      it("returns each sample case by id with the same record that list gives", async () => {
        await signInAs(ASHA);
        for (const listed of await allCases()) {
          expect(unwrap(await cases.get(listed.id))).toEqual(listed);
        }
      });

      it("has a story for a sample case that was described in words", async () => {
        await signInAs(ASHA);
        const story = unwrap(await cases.getStory("case-employment"));
        expect(story?.caseId).toBe("case-employment");
        expect(story?.narrative.length).toBeGreaterThan(0);
      });
    });

    describe("ownership", () => {
      it("reports another person's case as not_found for every request", async () => {
        const asha = await signInAs(ASHA);
        const hers = await readCase();
        const paper = unwrap(await documents.upload(hers.id, pdf()));
        unwrap(await chat.send(hers.id, "What should I do next?"));
        await auth.signOut();

        const bharat = await signInAs(BHARAT);
        expect(bharat.id).not.toBe(asha.id);

        const attempts: Record<string, Result<unknown>> = {
          "cases.get": await cases.get(hers.id),
          "cases.update": await cases.update(hers.id, { title: "Mine now" }),
          "cases.getStory": await cases.getStory(hers.id),
          "documents.list": await documents.list(hers.id),
          "documents.upload": await documents.upload(hers.id, pdf()),
          "documents.remove": await documents.remove(paper.id),
          "analysis.start": await analysis.start(hers.id),
          "analysis.status": await analysis.status(hers.id),
          "analysis.get": await analysis.get(hers.id),
          "chat.list": await chat.list(hers.id),
          "chat.send": await chat.send(hers.id, "What does it say?"),
          "cases.remove": await cases.remove(hers.id),
        };
        for (const [method, result] of Object.entries(attempts)) {
          expect(result, method).toMatchObject({ ok: false, error: { code: "not_found" } });
          expectFailure(result, "not_found");
        }

        const his = await allCases();
        expect(his.map((c) => c.id)).not.toContain(hers.id);
        expect(his.every((c) => c.citizenId === bharat.id)).toBe(true);
        const exported = unwrap(await account.exportData());
        expect(exported.cases.map((c) => c.record.id)).not.toContain(hers.id);
      });

      it("still hides the case when the second person signs in without the first signing out", async () => {
        await signInAs(ASHA);
        const hers = await newCase();
        await signInAs(BHARAT);

        expectFailure(await cases.get(hers.id), "not_found");
        expectFailure(await cases.getStory(hers.id), "not_found");
        expectFailure(await chat.list(hers.id), "not_found");
        expect((await allCases()).map((c) => c.id)).not.toContain(hers.id);
      });

      it("reports an id that does not exist in the same way", async () => {
        await signInAs(ASHA);
        expectFailure(await cases.get(NOWHERE), "not_found");
        expectFailure(await cases.update(NOWHERE, { title: "A name" }), "not_found");
        expectFailure(await cases.remove(NOWHERE), "not_found");
        expectFailure(await cases.getStory(NOWHERE), "not_found");
        expectFailure(await documents.list(NOWHERE), "not_found");
        expectFailure(await documents.upload(NOWHERE, pdf()), "not_found");
        expectFailure(await analysis.start(NOWHERE), "not_found");
        expectFailure(await analysis.status(NOWHERE), "not_found");
        expectFailure(await analysis.get(NOWHERE), "not_found");
        expectFailure(await chat.list(NOWHERE), "not_found");
        expectFailure(await chat.send(NOWHERE, "What does it say?"), "not_found");
      });

      it("reports a case that sits in the same store but is somebody else's as not_found", async () => {
        const asha = await signInAs(ASHA);
        const mine = await readCase();
        const theirs = await backstage.seedForeignCase();

        const attempts: Record<string, Result<unknown>> = {
          "cases.get": await cases.get(theirs.caseId),
          "cases.getStory": await cases.getStory(theirs.caseId),
          "cases.update": await cases.update(theirs.caseId, { title: "Mine now" }),
          "documents.list": await documents.list(theirs.caseId),
          "documents.upload": await documents.upload(theirs.caseId, pdf()),
          "documents.remove": await documents.remove(theirs.documentId),
          "analysis.start": await analysis.start(theirs.caseId),
          "analysis.start (again)": await analysis.start(theirs.caseId, { rerun: true }),
          "analysis.status": await analysis.status(theirs.caseId),
          "analysis.get": await analysis.get(theirs.caseId),
          "chat.list": await chat.list(theirs.caseId),
          "chat.send": await chat.send(theirs.caseId, "What does it say?"),
          "cases.remove": await cases.remove(theirs.caseId),
        };
        for (const [method, result] of Object.entries(attempts)) {
          expect(result, method).toMatchObject({ ok: false, error: { code: "not_found" } });
        }

        // Nor does it turn up in anything that lists.
        expect((await allCases()).map((c) => c.id)).not.toContain(theirs.caseId);
        expect((await allCases()).every((c) => c.citizenId === asha.id)).toBe(true);
        const papers = unwrap(await documents.listAll({ limit: 50 })).items;
        expect(papers.map((d) => d.id)).not.toContain(theirs.documentId);
        expect(papers.map((d) => d.caseId)).not.toContain(theirs.caseId);
        const coming = unwrap(await cases.upcomingDeadlines({ limit: 20 }));
        expect(coming.map((d) => d.caseId)).not.toContain(theirs.caseId);
        const exported = JSON.stringify(unwrap(await account.exportData()));
        expect(exported).not.toContain(theirs.caseId);
        expect(exported).not.toContain(theirs.documentId);

        // And the person's own things are untouched by all those attempts.
        expect(unwrap(await cases.get(mine.id))).toEqual(mine);
      });

      it("stamps a new case with the id of the person who made it", async () => {
        const asha = await signInAs(ASHA);
        expect((await newCase()).citizenId).toBe(asha.id);
      });
    });

    describe("creating a case", () => {
      beforeEach(async () => {
        await signInAs(ASHA);
      });

      it("creates a story-only case as a draft and lists it first", async () => {
        const created = unwrap(
          await cases.create({ ...storyCase("Deposit not returned"), city: "Pune", state: "Maharashtra" }),
        );

        expect(created.id).toEqual(expect.any(String));
        expect(SAMPLE_CASE_IDS).not.toContain(created.id);
        expect(created.status).toBe("draft");
        expect(created.title).toBe("Deposit not returned");
        expect(created.category).toBe("tenancy");
        expect(created.source).toBe("description");
        expect(created.location).toEqual({ city: "Pune", state: "Maharashtra" });
        expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
        expect(Number.isNaN(Date.parse(created.updatedAt))).toBe(false);

        const items = await allCases();
        expect(items).toHaveLength(4);
        expect(items[0].id).toBe(created.id);
        expect(unwrap(await cases.get(created.id))).toEqual(created);
      });

      it("gives every new case its own id", async () => {
        const first = await newCase("Same name");
        const second = await newCase("Same name");
        expect(second.id).not.toBe(first.id);
        expect(await allCases()).toHaveLength(5);
      });

      it("makes one case when the same requestId is sent twice", async () => {
        const requestId = crypto.randomUUID();
        const first = unwrap(await cases.create(storyCase("Tapped twice"), { requestId }));
        wait(3000);
        const second = unwrap(await cases.create(storyCase("Tapped twice"), { requestId }));

        expect(second).toEqual(first);
        expect(await allCases()).toHaveLength(4);

        const other = unwrap(await cases.create(storyCase("Tapped twice"), { requestId: crypto.randomUUID() }));
        expect(other.id).not.toBe(first.id);
        expect(await allCases()).toHaveLength(5);
      });

      it("refuses a requestId that is sent again with different details", async () => {
        const requestId = crypto.randomUUID();
        const first = unwrap(await cases.create(storyCase("First name"), { requestId }));
        expectFailure(
          await cases.create(storyCase("Another name"), { requestId }),
          "conflict",
          undefined,
          "request_reused",
        );
        expectFailure(
          await cases.create({ ...storyCase("First name"), story: { narrative: `${STORY} And more.` } }, { requestId }),
          "conflict",
          undefined,
          "request_reused",
        );
        expect(await allCases()).toHaveLength(4);
        expect(unwrap(await cases.get(first.id))).toEqual(first);
      });

      it("makes a new case when the one a requestId made has been removed", async () => {
        const requestId = crypto.randomUUID();
        const first = unwrap(await cases.create(storyCase(), { requestId }));
        unwrap(await cases.remove(first.id));
        const second = unwrap(await cases.create(storyCase(), { requestId }));
        expect(second.id).not.toBe(first.id);
        expect(await allCases()).toHaveLength(4);
      });

      it.each(["", "   "])("rejects the empty title %j", async (title) => {
        expectFailure(await cases.create({ ...storyCase(), title }), "invalid", "title", "empty");
        expect(await allCases()).toHaveLength(3);
      });

      it("rejects a title longer than MAX_TITLE_LENGTH and accepts one of exactly that length", async () => {
        expectFailure(
          await cases.create({ ...storyCase(), title: "x".repeat(MAX_TITLE_LENGTH + 1) }),
          "invalid",
          "title",
          "too_long",
        );
        const longest = "x".repeat(MAX_TITLE_LENGTH);
        expect(unwrap(await cases.create({ ...storyCase(), title: longest })).title).toBe(longest);
      });

      it.each(["description", "document_and_description"] as const)(
        "rejects a story shorter than MIN_STORY_LENGTH when the source is %s",
        async (source) => {
          const tooShort = "x".repeat(MIN_STORY_LENGTH - 1);
          expectFailure(
            await cases.create({ ...storyCase(), source, story: { narrative: tooShort } }),
            "invalid",
            "story",
            "too_short",
          );
          expectFailure(await cases.create({ ...storyCase(), source, story: undefined }), "invalid", "story");
          expect(await allCases()).toHaveLength(3);
        },
      );

      it("accepts a story of exactly MIN_STORY_LENGTH", async () => {
        const result = await cases.create({ ...storyCase(), story: { narrative: "x".repeat(MIN_STORY_LENGTH) } });
        expect(result.ok).toBe(true);
      });

      it("needs no story when the source is a document", async () => {
        const created = unwrap(await cases.create({ title: "Court notice", category: "other", source: "document" }));
        expect(created.status).toBe("draft");
        expect(created.source).toBe("document");
        expect(unwrap(await cases.getStory(created.id))).toBeNull();
      });

      it("getStory returns what was sent", async () => {
        const story = {
          narrative: STORY,
          whatHappened: "The deposit was kept.",
          whenHappened: "June 2026",
          whoInvolved: "My landlord",
          whatOutcomeWanted: "The deposit back.",
        };
        const created = unwrap(await cases.create({ ...storyCase(), story }));
        expect(unwrap(await cases.getStory(created.id))).toEqual({ ...story, caseId: created.id });
      });
    });

    describe("paging the case list", () => {
      beforeEach(async () => {
        await signInAs(ASHA);
        for (const title of ["One", "Two", "Three", "Four"]) await newCase(title);
      });

      it("returns the limit asked for and a cursor when there is more", async () => {
        const page = unwrap(await cases.list({ limit: 2 }));
        expect(page.items).toHaveLength(2);
        expect(page.nextCursor).toEqual(expect.any(String));
      });

      it("reaches every case exactly once, in the same order as one big page", async () => {
        const everything = await allCases();
        expect(everything).toHaveLength(7);

        const pages = await walk((cursor) => cases.list({ limit: 2, cursor }), 2);
        expect(pages.map((p) => p.length)).toEqual([2, 2, 2, 1]);
        const ids = pages.flat().map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toEqual(everything.map((c) => c.id));
      });

      it("lists newest first, with the cases just made ahead of the samples", async () => {
        const everything = await allCases();
        expect(everything.slice(0, 4).map((c) => c.title)).toEqual(["Four", "Three", "Two", "One"]);
        const stamps = everything.map((c) => c.createdAt);
        expect(stamps).toEqual([...stamps].sort().reverse());

        // Changing the oldest case does not move it up: the order is by when each was made.
        wait(5000);
        const oldest = everything[everything.length - 1];
        unwrap(await cases.update(oldest.id, { title: "Changed last" }));
        expect((await allCases()).map((c) => c.id)).toEqual(everything.map((c) => c.id));
      });

      it("does not repeat or skip a case when one is made and one removed between pages", async () => {
        const before = (await allCases()).map((c) => c.id);
        const firstPage = unwrap(await cases.list({ limit: 3 }));
        const shown = firstPage.items.map((c) => c.id);

        const added = await newCase("Made between pages");
        unwrap(await cases.remove(shown[1]));
        const removedLater = before[5];
        unwrap(await cases.remove(removedLater));

        const rest = await walk(
          (cursor) => cases.list({ limit: 3, cursor: cursor ?? firstPage.nextCursor ?? undefined }),
          3,
        );
        const later = rest.flat().map((c) => c.id);
        // Everything that was after the first page and still exists, once each, in order.
        expect(later).toEqual(before.slice(3).filter((id) => id !== removedLater));
        expect(later).not.toContain(added.id);
        for (const id of shown) expect(later).not.toContain(id);
      });

      it("ends with a null cursor when the last page is exactly full", async () => {
        const pages = await walk((cursor) => cases.list({ limit: 7, cursor }), 7);
        expect(pages.map((p) => p.length)).toEqual([7]);
      });

      it.each(["nonsense", "-1", "1.5", "{}"])("rejects the cursor %j as invalid", async (cursor) => {
        expectFailure(await cases.list({ cursor }), "invalid");
        expectFailure(await cases.list({ cursor, limit: 2 }), "invalid");
      });

      it("filters by status", async () => {
        const drafts = unwrap(await cases.list({ status: "draft" }));
        expect(drafts.items).toHaveLength(4);
        expect(drafts.items.every((c) => c.status === "draft")).toBe(true);

        const everything = await allCases();
        for (const status of ["ready", "needs_more_info", "processing", "error"] as const) {
          const page = unwrap(await cases.list({ status }));
          expect(page.items.every((c) => c.status === status)).toBe(true);
          expect(page.items.map((c) => c.id)).toEqual(
            everything.filter((c) => c.status === status).map((c) => c.id),
          );
        }
        expect(unwrap(await cases.list({ status: "ready" })).items.length).toBeGreaterThan(0);
        expect(unwrap(await cases.list({ status: "error" })).items).toEqual([]);
      });

      it("filters by several statuses at once, in the usual order", async () => {
        const everything = await allCases();
        const open = unwrap(await cases.list({ status: ["ready", "needs_more_info"] }));
        expect(open.items.map((c) => c.id)).toEqual(
          everything.filter((c) => c.status === "ready" || c.status === "needs_more_info").map((c) => c.id),
        );
        expect(open.items).toHaveLength(3);
        expect(unwrap(await cases.list({ status: [] })).items).toEqual([]);
      });

      it("keeps the order when a case changes while the list is being paged", async () => {
        const before = (await allCases()).map((c) => c.id);
        const firstPage = unwrap(await cases.list({ limit: 3 }));
        wait(5000);
        // Changing the oldest case must not move it up into a page already seen.
        unwrap(await cases.update("case-consumer", { title: "Changed while paging" }));
        const rest = await walk(
          (cursor) => cases.list({ limit: 3, cursor: cursor ?? firstPage.nextCursor ?? undefined }),
          3,
        );
        expect([...firstPage.items, ...rest.flat()].map((c) => c.id)).toEqual(before);
      });

      it("treats a limit that is not a number as none given, and a huge one as the most allowed", async () => {
        expect(unwrap(await cases.list({ limit: Number.NaN })).items).toHaveLength(7);
        for (let n = 0; n < 50; n += 1) unwrap(await cases.create(storyCase(`Extra ${n}`)));
        const page = unwrap(await cases.list({ limit: 1000 }));
        expect(page.items).toHaveLength(50);
        expect(page.nextCursor).toEqual(expect.any(String));
      });

      it("pages within a status filter", async () => {
        const pages = await walk((cursor) => cases.list({ status: "draft", limit: 3, cursor }), 3);
        expect(pages.map((p) => p.length)).toEqual([3, 1]);
        expect(pages.flat().every((c) => c.status === "draft")).toBe(true);
      });
    });

    describe("changing and removing a case", () => {
      beforeEach(async () => {
        await signInAs(ASHA);
      });

      it("update changes the title and updatedAt", async () => {
        const created = await newCase("Old name");
        wait(5000);
        const renamed = unwrap(await cases.update(created.id, { title: "New name" }));

        expect(renamed.id).toBe(created.id);
        expect(renamed.title).toBe("New name");
        expect(renamed.createdAt).toBe(created.createdAt);
        expect(Date.parse(renamed.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
        expect(unwrap(await cases.get(created.id))).toEqual(renamed);
        expect((await allCases()).find((c) => c.id === created.id)?.title).toBe("New name");
      });

      it("update of the title leaves everything but the title and updatedAt alone", async () => {
        const created = await newCase("Old name");
        wait(5000);
        const renamed = unwrap(await cases.update(created.id, { title: "New name" }));
        expect({ ...renamed, title: "", updatedAt: "" }).toEqual({ ...created, title: "", updatedAt: "" });
        expect(unwrap(await cases.getStory(created.id))?.narrative).toBe(STORY);
      });

      it.each(["", "   "])("update rejects the empty title %j and keeps the old one", async (title) => {
        const created = await newCase("Old name");
        expectFailure(await cases.update(created.id, { title: title }), "invalid", "title");
        expect(unwrap(await cases.get(created.id))).toEqual(created);
      });

      it("update rejects a title longer than MAX_TITLE_LENGTH", async () => {
        const created = await newCase("Old name");
        expectFailure(await cases.update(created.id, { title: "x".repeat(MAX_TITLE_LENGTH + 1) }), "invalid", "title");
        expect(unwrap(await cases.get(created.id)).title).toBe("Old name");
      });

      it("update changes what the case is about and where, and leaves out what was not sent", async () => {
        const created = unwrap(await cases.create({ ...storyCase("Old name"), city: "Pune", state: "Maharashtra" }));
        const moved = unwrap(await cases.update(created.id, { category: "consumer", city: "Nashik" }));

        expect(moved.title).toBe("Old name");
        expect(moved.category).toBe("consumer");
        expect(moved.location).toEqual({ city: "Nashik", state: "Maharashtra" });
        expect(unwrap(await cases.get(created.id))).toEqual(moved);
      });

      it("a sample case keeps the name the person gives it", async () => {
        unwrap(await cases.update("case-tenancy", { title: "My own name for it" }));
        expect(unwrap(await cases.get("case-tenancy")).title).toBe("My own name for it");
        expect((await allCases()).find((c) => c.id === "case-tenancy")?.title).toBe("My own name for it");
      });

      it("remove deletes the case with its papers, story, questions and job", async () => {
        const created = await readCase();
        const other = await newCase("Kept");
        const paper = unwrap(await documents.upload(created.id, pdf()));
        unwrap(await chat.send(created.id, "What should I do next?"));
        unwrap(await analysis.start(created.id));

        expect(unwrap(await cases.remove(created.id))).toBeNull();

        expectFailure(await cases.get(created.id), "not_found");
        expectFailure(await cases.getStory(created.id), "not_found");
        expectFailure(await documents.list(created.id), "not_found");
        expectFailure(await documents.remove(paper.id), "not_found");
        expectFailure(await analysis.status(created.id), "not_found");
        expectFailure(await analysis.get(created.id), "not_found");
        expectFailure(await chat.list(created.id), "not_found");
        expectFailure(await chat.send(created.id, "Is anyone there?"), "not_found");

        const ids = (await allCases()).map((c) => c.id);
        expect(ids).not.toContain(created.id);
        expect(ids).toContain(other.id);
        expect(ids).toHaveLength(4);

        const exported = unwrap(await account.exportData());
        expect(exported.cases.map((c) => c.record.id)).not.toContain(created.id);
        expect(JSON.stringify(exported)).not.toContain(paper.id);
      });

      it("does not finish the job of a case that was removed while it was being read", async () => {
        const created = await newCase();
        unwrap(await analysis.start(created.id));
        unwrap(await cases.remove(created.id));
        wait(60_000);
        expectFailure(await analysis.status(created.id), "not_found");
        expectFailure(await analysis.get(created.id), "not_found");
        expectFailure(await cases.get(created.id), "not_found");
      });

      it("removing a case twice is not_found the second time", async () => {
        const created = await newCase();
        unwrap(await cases.remove(created.id));
        expectFailure(await cases.remove(created.id), "not_found");
      });

      it("removing a sample case works and it stays removed", async () => {
        unwrap(await cases.remove("case-tenancy"));

        expectFailure(await cases.get("case-tenancy"), "not_found");
        expectFailure(await documents.list("case-tenancy"), "not_found");
        expectFailure(await analysis.get("case-tenancy"), "not_found");
        expectFailure(await analysis.status("case-tenancy"), "not_found");
        expectFailure(await documents.remove("doc-tenancy"), "not_found");

        wait(60_000);
        const left = await allCases();
        expect(left.map((c) => c.id).sort()).toEqual(["case-consumer", "case-employment"]);
        expect(await auth.getSession()).not.toBeNull();
      });

      it("lets the list become empty", async () => {
        for (const id of SAMPLE_CASE_IDS) unwrap(await cases.remove(id));
        expect(unwrap(await cases.list())).toEqual({ items: [], nextCursor: null });
        expect(unwrap(await account.exportData()).cases).toEqual([]);
      });
    });

    describe("documents", () => {
      let own: CaseRecord;

      beforeEach(async () => {
        await signInAs(ASHA);
        own = await newCase();
      });

      it("starts a new case with no papers", async () => {
        expect(unwrap(await documents.list(own.id))).toEqual([]);
      });

      it("uploads a PDF and a PNG and lists them with the right kind and size", async () => {
        const notice = unwrap(await documents.upload(own.id, pdf("notice.pdf", 1200)));
        const photo = unwrap(await documents.upload(own.id, png("photo.png", 640)));

        expect(notice).toMatchObject({
          caseId: own.id,
          fileName: "notice.pdf",
          mimeType: "application/pdf",
          kind: "pdf",
          byteSize: 1200,
        });
        expect(photo).toMatchObject({
          caseId: own.id,
          fileName: "photo.png",
          mimeType: "image/png",
          kind: "image",
          byteSize: 640,
        });
        expect(photo.id).not.toBe(notice.id);

        const listed = unwrap(await documents.list(own.id));
        expect(listed).toHaveLength(2);
        expect(listed.find((d) => d.id === notice.id)).toEqual(notice);
        expect(listed.find((d) => d.id === photo.id)).toEqual(photo);
      });

      it.each([
        ["photo.jpg", "image/jpeg"],
        ["photo.JPEG", "image/jpeg"],
        ["scan.webp", "image/webp"],
      ])("accepts %s as an image", async (fileName, type) => {
        const doc = unwrap(await documents.upload(own.id, new File([new Uint8Array(10)], fileName, { type })));
        expect(doc.kind).toBe("image");
        expect(doc.byteSize).toBe(10);
      });

      it("keeps the papers of one case out of another", async () => {
        const second = await newCase("Second");
        const paper = unwrap(await documents.upload(own.id, pdf()));
        expect(unwrap(await documents.list(second.id))).toEqual([]);
        expect(unwrap(await documents.list(own.id)).map((d) => d.id)).toEqual([paper.id]);
      });

      it.each([
        ["an .exe file", "setup.exe", "application/x-msdownload"],
        ["an .exe file with no type", "setup.exe", ""],
        ["a PDF type on an .exe name", "x.exe", "application/pdf"],
        ["a program type on a .pdf name", "x.pdf", "application/x-msdownload"],
        ["a web page", "page.html", "text/html"],
        ["a name with no ending", "notice", "application/pdf"],
      ])("rejects %s", async (_what, fileName, type) => {
        const file = new File([new Uint8Array(16)], fileName, { type });
        expectFailure(await documents.upload(own.id, file), "invalid", "file", "file_type");
        expect(unwrap(await documents.list(own.id))).toEqual([]);
      });

      it("rejects a file over the size limit and accepts one exactly on it", async () => {
        expectFailure(
          await documents.upload(own.id, fileOfSize("huge.pdf", "application/pdf", MAX_FILE_BYTES + 1)),
          "too_large",
          "file",
          "file_size",
        );
        expect(unwrap(await documents.list(own.id))).toEqual([]);

        const biggest = unwrap(
          await documents.upload(own.id, fileOfSize("biggest.pdf", "application/pdf", MAX_FILE_BYTES)),
        );
        expect(biggest.byteSize).toBe(MAX_FILE_BYTES);
      });

      it("stores a paper once when the same requestId is sent twice", async () => {
        const requestId = crypto.randomUUID();
        const first = unwrap(await documents.upload(own.id, pdf("notice.pdf", 1200), { requestId }));
        wait(3000);
        const second = unwrap(await documents.upload(own.id, pdf("notice.pdf", 1200), { requestId }));
        expect(second).toEqual(first);
        expect(unwrap(await documents.list(own.id))).toHaveLength(1);

        expectFailure(
          await documents.upload(own.id, png("other.png"), { requestId }),
          "conflict",
          undefined,
          "request_reused",
        );
        // Without an id, the same file sent twice is two papers.
        unwrap(await documents.upload(own.id, pdf("notice.pdf", 1200)));
        expect(unwrap(await documents.list(own.id))).toHaveLength(2);
      });

      it("stamps each paper with when it was added, and lists the newest first across cases", async () => {
        const older = unwrap(await documents.upload(own.id, pdf("older.pdf")));
        wait(60_000);
        const second = await newCase("Second");
        const newer = unwrap(await documents.upload(second.id, pdf("newer.pdf")));
        expect(Date.parse(newer.createdAt)).toBeGreaterThan(Date.parse(older.createdAt));

        const all = unwrap(await documents.listAll({ limit: 50 })).items;
        expect(all.slice(0, 2).map((d) => d.id)).toEqual([newer.id, older.id]);
        const stamps = all.map((d) => d.createdAt);
        expect(stamps).toEqual([...stamps].sort().reverse());
      });

      it("remove deletes one paper and leaves the others", async () => {
        const notice = unwrap(await documents.upload(own.id, pdf()));
        const photo = unwrap(await documents.upload(own.id, png()));

        expect(unwrap(await documents.remove(notice.id))).toBeNull();
        expect(unwrap(await documents.list(own.id)).map((d) => d.id)).toEqual([photo.id]);
        expectFailure(await documents.remove(notice.id), "not_found");
      });

      it("removing an unknown paper is not_found", async () => {
        expectFailure(await documents.remove("doc-does-not-exist"), "not_found");
      });

      it("listAll returns every paper with the name of its case, and pages", async () => {
        const notice = unwrap(await documents.upload(own.id, pdf("notice.pdf")));
        const photo = unwrap(await documents.upload(own.id, png("photo.png")));

        const everything = unwrap(await documents.listAll({ limit: 50 }));
        expect(everything.nextCursor).toBeNull();
        const mine = everything.items.filter((d) => d.caseId === own.id);
        expect(mine.map((d) => d.id).sort()).toEqual([notice.id, photo.id].sort());
        expect(mine.every((d) => d.caseTitle === own.title)).toBe(true);
        // The newest case comes first, and the samples' own papers are there too.
        expect(everything.items[0].caseId).toBe(own.id);
        expect(everything.items.map((d) => d.id)).toContain("doc-tenancy");
        expect(everything.items.every((d) => d.caseTitle.length > 0)).toBe(true);

        const pages = await walk((cursor) => documents.listAll({ limit: 1, cursor }), 1);
        expect(pages.flat().map((d) => d.id)).toEqual(everything.items.map((d) => d.id));
        expectFailure(await documents.listAll({ cursor: "nonsense" }), "invalid");
      });

      it("lists and removes the paper of a sample case", async () => {
        const listed = unwrap(await documents.list("case-tenancy"));
        expect(listed.map((d) => d.id)).toEqual(["doc-tenancy"]);
        expect(listed[0]).toMatchObject({ caseId: "case-tenancy", kind: "pdf" });

        unwrap(await documents.remove("doc-tenancy"));
        expect(unwrap(await documents.list("case-tenancy"))).toEqual([]);
        expect(unwrap(await cases.get("case-tenancy")).id).toBe("case-tenancy");
      });
    });

    describe("reading a case in the background", () => {
      let own: CaseRecord;

      beforeEach(async () => {
        await signInAs(ASHA);
        own = await newCase();
      });

      it("a draft that was never started has no job, and no explanation to get", async () => {
        expect(unwrap(await analysis.status(own.id))).toBeNull();
        expectFailure(await analysis.get(own.id), "conflict", undefined, "never_started");
        expect(unwrap(await cases.get(own.id)).status).toBe("draft");
      });

      it("start returns a queued job at once and the case becomes processing", async () => {
        const job = unwrap(await analysis.start(own.id));
        expect(job.caseId).toBe(own.id);
        expect(job.state).toBe("queued");
        expect(Number.isNaN(Date.parse(job.startedAt))).toBe(false);
        expect(Number.isNaN(Date.parse(job.updatedAt))).toBe(false);

        expect(unwrap(await cases.get(own.id)).status).toBe("processing");
        expect(unwrap(await cases.list({ status: "processing" })).items.map((c) => c.id)).toEqual([own.id]);
        expect(unwrap(await analysis.status(own.id))).toMatchObject({ caseId: own.id, state: "queued" });
      });

      it("start again while it is running returns the same job", async () => {
        const first = unwrap(await analysis.start(own.id));
        wait(300);
        const second = unwrap(await analysis.start(own.id));
        expect(second.caseId).toBe(own.id);
        expect(second.startedAt).toBe(first.startedAt);
        wait(600);
        const third = unwrap(await analysis.start(own.id));
        expect(third.startedAt).toBe(first.startedAt);
        expect(unwrap(await analysis.status(own.id))?.startedAt).toBe(first.startedAt);
        expect(unwrap(await analysis.status(own.id))?.id).toBe(first.id);
      });

      it("moves through queued, reading, writing and ready as time passes", async () => {
        const started = unwrap(await analysis.start(own.id));
        expect(await pollUntilReady(own.id)).toEqual(["queued", "reading", "writing", "ready"]);
        expect(unwrap(await analysis.status(own.id))?.startedAt).toBe(started.startedAt);
      });

      it("get is a conflict (not_ready) until the job is ready, and the explanation afterwards", async () => {
        unwrap(await analysis.start(own.id));
        expectFailure(await analysis.get(own.id), "conflict", undefined, "not_ready");

        // Looks before every poll, so each state before "ready" is covered.
        for (let turn = 0; turn < 600; turn += 1) {
          const job = unwrap(await analysis.status(own.id));
          if (!job) throw new Error("the case has no job");
          if (job.state === "ready") break;
          expect(job.state).not.toBe("failed");
          expectFailure(await analysis.get(own.id), "conflict", undefined, "not_ready");
          wait(100);
        }

        const explanation = unwrap(await analysis.get(own.id));
        expect(explanation.caseId).toBe(own.id);
        expect(explanation.plainLanguageSummary.length).toBeGreaterThan(0);
        expect(explanation.overview.oneLine.length).toBeGreaterThan(0);
        expect(Array.isArray(explanation.nextSteps)).toBe(true);
        expect(Array.isArray(explanation.deadlines)).toBe(true);
      });

      it("marks the case ready once the job is ready", async () => {
        unwrap(await analysis.start(own.id));
        await pollUntilReady(own.id);

        const record = unwrap(await cases.get(own.id));
        expect(record.status).toBe("ready");
        expect(Date.parse(record.updatedAt)).toBeGreaterThan(Date.parse(own.updatedAt));
        expect(unwrap(await cases.list({ status: "ready" })).items.map((c) => c.id)).toContain(own.id);
        expect(unwrap(await cases.list({ status: "processing" })).items).toEqual([]);
      });

      it("stays ready, and keeps its explanation, long after it finished", async () => {
        unwrap(await analysis.start(own.id));
        await pollUntilReady(own.id);
        wait(24 * 60 * 60 * 1000);
        expect(unwrap(await analysis.status(own.id))?.state).toBe("ready");
        expect(unwrap(await analysis.get(own.id)).caseId).toBe(own.id);
        expect(unwrap(await analysis.start(own.id)).state).toBe("ready");
        expect(unwrap(await cases.get(own.id)).status).toBe("ready");
      });

      // "The work carries on in the background, even if the person closes the
      // page": nobody is polling here, so the case list alone must show it finished.
      it("finishes the case without anyone asking for the status", async () => {
        const started = unwrap(await analysis.start(own.id));
        wait(10 * 60 * 1000);
        const record = unwrap(await cases.get(own.id));
        expect(record.status).toBe("ready");
        // Finished when the work finished, not when somebody came to look.
        expect(Date.parse(record.updatedAt) - Date.parse(started.startedAt)).toBeLessThan(60_000);
        expect(unwrap(await cases.list({ status: "ready" })).items.map((c) => c.id)).toContain(own.id);
      });

      it("has nothing to read in a case with no paper and no story, until a paper is added", async () => {
        const bare = unwrap(await cases.create({ title: "Court notice", category: "other", source: "document" }));
        expectFailure(await analysis.start(bare.id), "conflict", undefined, "nothing_to_read");
        expect(unwrap(await cases.get(bare.id)).status).toBe("draft");
        expect(unwrap(await analysis.status(bare.id))).toBeNull();

        unwrap(await documents.upload(bare.id, pdf()));
        expect(unwrap(await analysis.start(bare.id)).state).toBe("queued");
      });

      it("writes the explanation in the language asked for, and keeps it in that language", async () => {
        const job = unwrap(await analysis.start(own.id, { language: "en" }));
        expect(job.language).toBe("en");
        await pollUntilReady(own.id);
        const english = unwrap(await analysis.get(own.id));
        expect(english.language).toBe("en");
        expect(unwrap(await analysis.status(own.id))?.language).toBe("en");

        // Asking again without `rerun` changes nothing, whatever language is named.
        expect(unwrap(await analysis.start(own.id, { language: "hi" })).id).toBe(job.id);
        expect(unwrap(await analysis.get(own.id))).toEqual(english);
      });

      it("uses the person's own language when none is asked for", async () => {
        const user = unwrap(await account.updateProfile({ preferredLanguage: "hi" }));
        expect(user.preferredLanguage).toBe("hi");
        expect(unwrap(await analysis.start(own.id)).language).toBe("hi");
      });

      it("reads a finished case again when rerun is set, as a new job", async () => {
        const first = unwrap(await analysis.start(own.id, { language: "en" }));
        await pollUntilReady(own.id);
        const english = unwrap(await analysis.get(own.id));
        wait(60_000);

        const second = unwrap(await analysis.start(own.id, { rerun: true, language: "hi" }));
        expect(second.id).not.toBe(first.id);
        expect(second).toMatchObject({ caseId: own.id, state: "queued", language: "hi" });
        // What the person already has stays theirs while the new reading runs.
        expect(unwrap(await cases.get(own.id)).status).toBe("ready");
        expect(unwrap(await analysis.get(own.id))).toEqual(english);
        expect(unwrap(await chat.send(own.id, "What should I do next?"))).toHaveLength(2);
        expect(unwrap(await analysis.status(own.id))).toMatchObject({ id: second.id, state: "queued" });
        // A second tap while it runs does not start a third.
        expect(unwrap(await analysis.start(own.id, { rerun: true, language: "hi" })).id).toBe(second.id);

        await pollUntilReady(own.id);
        const hindi = unwrap(await analysis.get(own.id));
        expect(hindi.language).toBe("hi");
        expect(hindi.plainLanguageSummary).not.toBe(english.plainLanguageSummary);
        expect(unwrap(await cases.get(own.id)).status).toBe("ready");
      });

      it("keeps the earlier explanation when reading again fails, and lets it be tried once more", async () => {
        unwrap(await analysis.start(own.id, { language: "en" }));
        await pollUntilReady(own.id);
        const english = unwrap(await analysis.get(own.id));
        const before = unwrap(await cases.get(own.id));
        const datesBefore = unwrap(await cases.upcomingDeadlines({ limit: 20 }));

        await backstage.failReadings(true);
        unwrap(await analysis.start(own.id, { rerun: true, language: "hi" }));
        expect(await pollUntilReady(own.id)).toContain("failed");

        expect(unwrap(await cases.get(own.id))).toEqual(before);
        expect(unwrap(await analysis.get(own.id))).toEqual(english);
        expect(unwrap(await cases.upcomingDeadlines({ limit: 20 }))).toEqual(datesBefore);
        expect(unwrap(await chat.send(own.id, "What should I do next?"))).toHaveLength(2);

        await backstage.failReadings(false);
        // After a failure, asking again starts a new reading without `rerun`.
        const third = unwrap(await analysis.start(own.id, { language: "hi" }));
        expect(third.state).toBe("queued");
        expect(unwrap(await analysis.get(own.id))).toEqual(english);
        expect(await pollUntilReady(own.id)).toEqual(["queued", "reading", "writing", "ready"]);
        expect(unwrap(await analysis.get(own.id)).language).toBe("hi");
      });

      it("reports a first reading that fails, and reads again when asked", async () => {
        await backstage.failReadings(true);
        const first = unwrap(await analysis.start(own.id));
        expect(await pollUntilReady(own.id)).toEqual(["queued", "reading", "writing", "failed"]);

        const failed = unwrap(await analysis.status(own.id));
        expect(failed).toMatchObject({ id: first.id, state: "failed" });
        expect(typeof failed?.failure?.retryable).toBe("boolean");
        expect(failed?.failure?.reason.length).toBeGreaterThan(0);
        expect(unwrap(await cases.get(own.id)).status).toBe("error");
        expect(unwrap(await cases.list({ status: "error" })).items.map((c) => c.id)).toEqual([own.id]);
        expectFailure(await analysis.get(own.id), "conflict", undefined, "reading_failed");
        expectFailure(await chat.send(own.id, "What should I do next?"), "conflict", undefined, "reading_failed");

        await backstage.failReadings(false);
        const second = unwrap(await analysis.start(own.id));
        expect(second.id).not.toBe(first.id);
        expect(second.state).toBe("queued");
        expect(second.failure).toBeUndefined();
        expect(unwrap(await cases.get(own.id)).status).toBe("processing");
        expect(await pollUntilReady(own.id)).toEqual(["queued", "reading", "writing", "ready"]);
        expect(unwrap(await cases.get(own.id)).status).toBe("ready");
        expect(unwrap(await analysis.get(own.id)).caseId).toBe(own.id);
      });

      it("a failed reading still lets the case be removed", async () => {
        await backstage.failReadings(true);
        unwrap(await analysis.start(own.id));
        await pollUntilReady(own.id);
        expect(unwrap(await cases.remove(own.id))).toBeNull();
        expectFailure(await cases.get(own.id), "not_found");
      });

      it("lists the dates that are still to come, nearest first", async () => {
        const coming = unwrap(await cases.upcomingDeadlines({ limit: 20 }));
        expect(coming.length).toBeGreaterThan(0);
        const ids = (await allCases()).map((c) => c.id);
        for (const item of coming) {
          expect(ids).toContain(item.caseId);
          expect(item.caseTitle.length).toBeGreaterThan(0);
          expect(item.label.length).toBeGreaterThan(0);
          expect(Date.parse(item.date)).toBeGreaterThanOrEqual(Date.parse("2026-10-09"));
        }
        const dates = coming.map((item) => item.date);
        expect(dates).toEqual([...dates].sort());

        expect(unwrap(await cases.upcomingDeadlines({ limit: 1 }))).toEqual(coming.slice(0, 1));
        expect(unwrap(await cases.upcomingDeadlines()).length).toBeLessThanOrEqual(3);
      });

      it("leaves out every date once it has passed", async () => {
        expect(unwrap(await cases.upcomingDeadlines({ limit: 20 })).length).toBeGreaterThan(0);
        // Far enough ahead that every sample date, which follows the real calendar, is behind it.
        vi.setSystemTime(new Date("2100-01-01T00:00:00.000Z"));
        expect(unwrap(await cases.upcomingDeadlines({ limit: 20 }))).toEqual([]);
      });

      it("leaves out the dates of a case that has been removed", async () => {
        const before = unwrap(await cases.upcomingDeadlines({ limit: 20 }));
        const gone = before[0].caseId;
        unwrap(await cases.remove(gone));
        const after = unwrap(await cases.upcomingDeadlines({ limit: 20 }));
        expect(after.map((item) => item.caseId)).not.toContain(gone);
      });

      it("reads each case on its own", async () => {
        const second = await newCase("Second");
        unwrap(await analysis.start(own.id));
        expect(unwrap(await analysis.status(second.id))).toBeNull();
        await pollUntilReady(own.id);
        expectFailure(await analysis.get(second.id), "conflict", undefined, "never_started");
        expect(unwrap(await cases.get(second.id)).status).toBe("draft");
      });

      it.each(SAMPLE_CASE_IDS)("the sample case %s is ready without start ever being called", async (id) => {
        const job = unwrap(await analysis.status(id));
        expect(job).toMatchObject({ caseId: id, state: "ready" });
        const explanation = unwrap(await analysis.get(id));
        expect(explanation.caseId).toBe(id);
        expect(explanation.plainLanguageSummary.length).toBeGreaterThan(0);
      });

      it("start on a sample case reports it ready and leaves the case as it was", async () => {
        const before = unwrap(await cases.get("case-tenancy"));
        expect(unwrap(await analysis.start("case-tenancy"))).toMatchObject({ caseId: "case-tenancy", state: "ready" });
        expect(unwrap(await cases.get("case-tenancy"))).toEqual(before);
      });
    });

    describe("chat", () => {
      let own: CaseRecord;

      async function thread(caseId = own.id): Promise<ChatMessage[]> {
        const page = unwrap(await chat.list(caseId, { limit: 50 }));
        expect(page.nextCursor).toBeNull();
        return page.items;
      }

      beforeEach(async () => {
        await signInAs(ASHA);
        own = await readCase();
      });

      it("starts with an empty thread", async () => {
        expect(unwrap(await chat.list(own.id))).toEqual({ items: [], nextCursor: null });
      });

      it("send returns the trimmed question and then a reply", async () => {
        const sent = unwrap(await chat.send(own.id, "  What should I do next?  \n"));

        expect(sent).toHaveLength(2);
        const [question, reply] = sent;
        expect(question.role).toBe("user");
        expect(question.content).toBe("What should I do next?");
        expect(question.caseId).toBe(own.id);
        expect(reply.role).toBe("assistant");
        expect(reply.content.trim().length).toBeGreaterThan(0);
        expect(reply.caseId).toBe(own.id);
        expect(reply.id).not.toBe(question.id);
        expect(Number.isNaN(Date.parse(question.createdAt))).toBe(false);
        expect(Number.isNaN(Date.parse(reply.createdAt))).toBe(false);
      });

      it("list returns the messages oldest first", async () => {
        const first = unwrap(await chat.send(own.id, "Who can help me?"));
        wait(1000);
        const second = unwrap(await chat.send(own.id, "What is the last date?"));

        const items = await thread();
        expect(items.map((m) => m.id)).toEqual([...first, ...second].map((m) => m.id));
        expect(items.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
        expect(items[0].content).toBe("Who can help me?");
        expect(items[2].content).toBe("What is the last date?");
        const stamps = items.map((m) => m.createdAt);
        expect(stamps).toEqual([...stamps].sort());
        expect(items.every((m) => m.caseId === own.id && m.content.trim().length > 0)).toBe(true);
      });

      it.each(["", "   ", "\n\t"])("rejects the empty question %j", async (content) => {
        expectFailure(await chat.send(own.id, content), "invalid", "content");
        expectFailure(await chat.send(own.id, content, { requestId: "retry-empty" }), "invalid", "content");
        expect(await thread()).toEqual([]);
      });

      it("sending twice with the same requestId returns the first answer and adds nothing", async () => {
        const requestId = crypto.randomUUID();
        const first = unwrap(await chat.send(own.id, "What should I do next?", { requestId }));
        wait(3000);
        const retry = unwrap(await chat.send(own.id, "What should I do next?", { requestId }));

        expect(retry).toHaveLength(2);
        expect(retry.map((m) => m.id)).toEqual(first.map((m) => m.id));
        expect(retry.map((m) => m.role)).toEqual(["user", "assistant"]);
        expect(retry[0].content).toBe("What should I do next?");
        expect((await thread()).map((m) => m.id)).toEqual(first.map((m) => m.id));
      });

      it("a retry still returns the first answer after other questions have been asked", async () => {
        const first = unwrap(await chat.send(own.id, "Who can help me?", { requestId: "req-1" }));
        const second = unwrap(await chat.send(own.id, "What is the last date?", { requestId: "req-2" }));
        expect(second.map((m) => m.id)).not.toEqual(first.map((m) => m.id));

        const retry = unwrap(await chat.send(own.id, "Who can help me?", { requestId: "req-1" }));
        expect(retry.map((m) => m.id)).toEqual(first.map((m) => m.id));
        expect(await thread()).toHaveLength(4);
      });

      it("different requestIds are different questions", async () => {
        unwrap(await chat.send(own.id, "What should I do next?", { requestId: "req-1" }));
        unwrap(await chat.send(own.id, "What should I do next?", { requestId: "req-2" }));
        expect(await thread()).toHaveLength(4);
      });

      it("without a requestId the same text sent twice adds four messages", async () => {
        const first = unwrap(await chat.send(own.id, "What should I do next?"));
        const second = unwrap(await chat.send(own.id, "What should I do next?"));

        const items = await thread();
        expect(items).toHaveLength(4);
        expect(new Set(items.map((m) => m.id)).size).toBe(4);
        expect(items.map((m) => m.id)).toEqual([...first, ...second].map((m) => m.id));
      });

      it("pages the thread with limit and cursor", async () => {
        for (const question of ["Who can help me?", "What is the last date?", "What should I do next?"]) {
          wait(1000);
          unwrap(await chat.send(own.id, question));
        }
        const everything = await thread();
        expect(everything).toHaveLength(6);

        const firstPage = unwrap(await chat.list(own.id, { limit: 4 }));
        expect(firstPage.items).toHaveLength(4);
        expect(firstPage.nextCursor).toEqual(expect.any(String));
        // The first page is the latest four, oldest first; the cursor leads back to the ones before.
        expect(firstPage.items).toEqual(everything.slice(2));

        const pages = await walk((cursor) => chat.list(own.id, { limit: 4, cursor }), 4);
        expect(pages.map((p) => p.length)).toEqual([4, 2]);
        expect([...pages].reverse().flat()).toEqual(everything);

        const byTwo = await walk((cursor) => chat.list(own.id, { limit: 2, cursor }), 2);
        expect(byTwo.map((p) => p.length)).toEqual([2, 2, 2]);
        expect([...byTwo].reverse().flat().map((m) => m.id)).toEqual(everything.map((m) => m.id));
      });

      it("shows the latest questions first when the thread is longer than a page", async () => {
        for (let n = 0; n < 12; n += 1) {
          wait(1000);
          unwrap(await chat.send(own.id, `Question number ${n}?`));
        }
        const page = unwrap(await chat.list(own.id));
        expect(page.items).toHaveLength(20);
        expect(page.nextCursor).toEqual(expect.any(String));
        expect(page.items[page.items.length - 2].content).toBe("Question number 11?");
        expect(page.items[0].content).toBe("Question number 2?");
      });

      it("does not repeat a message when a question is sent between two pages", async () => {
        for (let n = 0; n < 12; n += 1) {
          wait(1000);
          unwrap(await chat.send(own.id, `Question number ${n}?`));
        }
        const before = await thread();
        const latest = unwrap(await chat.list(own.id, { limit: 10 }));
        expect(latest.items.map((m) => m.id)).toEqual(before.slice(-10).map((m) => m.id));

        wait(1000);
        unwrap(await chat.send(own.id, "One more question?"));

        // The cursor still leads to exactly the messages before the ones already shown.
        const earlier = await walk(
          (cursor) => chat.list(own.id, { limit: 10, cursor: cursor ?? latest.nextCursor ?? undefined }),
          10,
        );
        const earlierIds = [...earlier].reverse().flat().map((m) => m.id);
        expect(earlierIds).toEqual(before.slice(0, -10).map((m) => m.id));
      });

      it("says which language each reply is in", async () => {
        const [question, reply] = unwrap(await chat.send(own.id, "What should I do next?", { language: "hi" }));
        expect(reply.language).toBe("hi");
        expect(question.language).toBeUndefined();
        expect((await thread())[1].language).toBe("hi");
      });

      it("refuses a requestId that is used again for a different question", async () => {
        const first = unwrap(await chat.send(own.id, "Who can help me?", { requestId: "req-1" }));
        expectFailure(
          await chat.send(own.id, "What is the last date?", { requestId: "req-1" }),
          "conflict",
          undefined,
          "request_reused",
        );
        expect((await thread()).map((m) => m.id)).toEqual(first.map((m) => m.id));
      });

      it("answers only once the case has an explanation", async () => {
        const draft = await newCase("Not read yet");
        expectFailure(await chat.send(draft.id, "What should I do next?"), "conflict", undefined, "never_started");
        expect(unwrap(await chat.list(draft.id))).toEqual({ items: [], nextCursor: null });

        unwrap(await analysis.start(draft.id));
        expectFailure(await chat.send(draft.id, "What should I do next?"), "conflict", undefined, "not_ready");
        await pollUntilReady(draft.id);
        expect(unwrap(await chat.send(draft.id, "What should I do next?"))).toHaveLength(2);
      });

      it("replies in the language asked for, and the reply stays in that language", async () => {
        const [, english] = unwrap(await chat.send(own.id, "What should I do next?", { language: "en" }));
        const [, hindi] = unwrap(await chat.send(own.id, "What should I do next?", { language: "hi" }));
        expect(hindi.content).not.toBe(english.content);

        const items = await thread();
        expect(items[1].content).toBe(english.content);
        expect(items[3].content).toBe(hindi.content);
      });

      it("rejects a nonsense cursor as invalid", async () => {
        unwrap(await chat.send(own.id, "What should I do next?"));
        expectFailure(await chat.list(own.id, { cursor: "nonsense" }), "invalid");
      });

      it("keeps each case's questions to that case", async () => {
        unwrap(await chat.send(own.id, "What should I do next?"));
        expect(await thread("case-tenancy")).toEqual([]);

        const onSample = unwrap(await chat.send("case-tenancy", "What is the last date?"));
        expect(onSample.every((m) => m.caseId === "case-tenancy")).toBe(true);
        expect((await thread("case-tenancy")).map((m) => m.id)).toEqual(onSample.map((m) => m.id));
        expect(await thread()).toHaveLength(2);
      });
    });

    describe("account", () => {
      it("exportData holds the user and every case with its story, papers and questions", async () => {
        const asha = await signInAs(ASHA);
        const own = await readCase("Deposit not returned");
        const paper = unwrap(await documents.upload(own.id, pdf("notice.pdf", 1200)));
        const sent = unwrap(await chat.send(own.id, "What should I do next?"));
        const paperOnly = unwrap(await cases.create({ title: "Court notice", category: "other", source: "document" }));
        wait(1000);

        const exported = unwrap(await account.exportData());

        expect(exported.user).toEqual(asha);
        expect(Number.isNaN(Date.parse(exported.exportedAt))).toBe(false);
        const listed = await allCases();
        expect(exported.cases).toHaveLength(5);
        expect(exported.cases.map((c) => c.record.id).sort()).toEqual(listed.map((c) => c.id).sort());
        expect(exported.cases.every((c) => c.record.citizenId === asha.id)).toBe(true);

        const mine = exported.cases.find((c) => c.record.id === own.id);
        expect(mine?.record).toEqual(unwrap(await cases.get(own.id)));
        expect(mine?.story).toEqual({ narrative: STORY, caseId: own.id });
        expect(mine?.documents).toEqual([paper]);
        expect(mine?.questions).toEqual(sent);
        expect(mine?.analysis).toEqual(unwrap(await analysis.get(own.id)));

        const bare = exported.cases.find((c) => c.record.id === paperOnly.id);
        expect(bare).toMatchObject({ story: null, documents: [], analysis: null, questions: [] });

        for (const id of SAMPLE_CASE_IDS) {
          const sample = exported.cases.find((c) => c.record.id === id);
          expect(sample?.story).toEqual(unwrap(await cases.getStory(id)));
          expect(sample?.documents).toEqual(unwrap(await documents.list(id)));
          expect(sample?.analysis).toEqual(unwrap(await analysis.get(id)));
          expect(sample?.questions).toEqual([]);
        }
      });

      it("exportData holds every question of a long thread and every case of a long list", async () => {
        await signInAs(ASHA);
        const own = await readCase();
        for (let n = 0; n < 30; n += 1) unwrap(await chat.send(own.id, `Question number ${n}?`));
        for (let n = 0; n < 55; n += 1) unwrap(await cases.create(storyCase(`Case ${n}`)));

        const exported = unwrap(await account.exportData());
        expect(exported.cases).toHaveLength(3 + 1 + 55);
        const questions = exported.cases.find((c) => c.record.id === own.id)?.questions ?? [];
        expect(questions).toHaveLength(60);
        expect(questions.filter((m) => m.role === "user").map((m) => m.content)).toEqual(
          Array.from({ length: 30 }, (_, n) => `Question number ${n}?`),
        );
      });

      it("exportData can be saved as text and changes nothing", async () => {
        await signInAs(ASHA);
        await newCase();
        const before = await allCases();
        const exported = unwrap(await account.exportData());
        expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
        expect(await allCases()).toEqual(before);
      });

      it("deleteAccount ends the session and nothing the person made survives", async () => {
        const asha = await signInAs(ASHA);
        const own = await readCase();
        const paper = unwrap(await documents.upload(own.id, pdf()));
        unwrap(await chat.send(own.id, "What should I do next?"));
        unwrap(await chat.send("case-tenancy", "What is the last date?"));
        unwrap(await cases.remove("case-consumer"));

        expect(unwrap(await account.deleteAccount())).toBeNull();

        expect(await auth.getSession()).toBeNull();
        expectFailure(await cases.list(), "unauthenticated");
        expectFailure(await cases.get(own.id), "unauthenticated");
        expectFailure(await account.exportData(), "unauthenticated");
        expectFailure(await account.deleteAccount(), "unauthenticated");

        const again = await signInAs(ASHA);
        expect(again.id).toBe(asha.id);
        const items = await allCases();
        expect(items.map((c) => c.id).sort()).toEqual(SAMPLE_CASE_IDS);
        expectFailure(await cases.get(own.id), "not_found");
        expectFailure(await cases.getStory(own.id), "not_found");
        expectFailure(await documents.list(own.id), "not_found");
        expectFailure(await documents.remove(paper.id), "not_found");
        expectFailure(await chat.list(own.id), "not_found");
        expectFailure(await analysis.status(own.id), "not_found");
        expect(unwrap(await chat.list("case-tenancy")).items).toEqual([]);

        const exported = unwrap(await account.exportData());
        expect(exported.cases).toHaveLength(3);
        expect(exported.cases.every((c) => c.questions.length === 0)).toBe(true);
      });
    });

    describe("profile", () => {
      it("updateProfile changes the name and the language, and the session shows it", async () => {
        const asha = await signInAs(ASHA);
        const changed = unwrap(await account.updateProfile({ displayName: "  Asha Kale ", preferredLanguage: "en" }));

        expect(changed).toEqual({ ...asha, displayName: "Asha Kale", preferredLanguage: "en" });
        expect(await auth.getSession()).toEqual(changed);
        expect(unwrap(await account.exportData()).user).toEqual(changed);
        // Nothing else of the person's is touched.
        expect(await allCases()).toHaveLength(3);
      });

      it("updateProfile leaves alone what was not sent", async () => {
        const asha = await signInAs(ASHA);
        expect(unwrap(await account.updateProfile({ preferredLanguage: "hi" }))).toEqual({
          ...asha,
          preferredLanguage: "hi",
        });
        expect(unwrap(await account.updateProfile({}))).toEqual({ ...asha, preferredLanguage: "hi" });
      });

      it("updateProfile rejects an empty name and a language that is not offered", async () => {
        const asha = await signInAs(ASHA);
        expectFailure(await account.updateProfile({ displayName: "   " }), "invalid", "displayName", "empty");
        expectFailure(
          await account.updateProfile({ preferredLanguage: "fr" as unknown as User["preferredLanguage"] }),
          "invalid",
          "preferredLanguage",
        );
        expect(await auth.getSession()).toEqual(asha);
      });
    });

    describe("result shape", () => {
      it("a success carries data and no error", async () => {
        const signedIn = await auth.signIn(ASHA);
        const listed = await cases.list();
        const removed = await cases.remove("case-tenancy");
        for (const result of [signedIn, listed, removed]) {
          expect(result.ok).toBe(true);
          expect(result).toHaveProperty("data");
          expect(result).not.toHaveProperty("error");
        }
        expect(removed).toEqual({ ok: true, data: null });
      });

      it("every failure has a code from ErrorCode and nothing named message", async () => {
        const failures: Result<unknown>[] = [
          await cases.list(),
          await auth.signIn({ email: "not-an-email" }),
        ];
        await signInAs(ASHA);
        const own = await newCase();
        failures.push(
          await cases.get(NOWHERE),
          await cases.create({ ...storyCase(), title: "" }),
          await cases.create({ ...storyCase(), story: { narrative: "short" } }),
          await cases.update(own.id, { title: "" }),
          await cases.list({ cursor: "nonsense" }),
          await documents.upload(own.id, pdf("virus.exe")),
          await documents.remove("doc-does-not-exist"),
          await analysis.start(NOWHERE),
          await analysis.get(own.id),
          await chat.send(own.id, ""),
          await chat.list(own.id, { cursor: "nonsense" }),
        );

        expect(failures).toHaveLength(13);
        for (const failure of failures) {
          expect(failure.ok).toBe(false);
          if (failure.ok) continue;
          expect(Object.keys(failure).sort()).toEqual(["error", "ok"]);
          expect(Object.keys(KNOWN_CODES)).toContain(failure.error.code);
          expect(failure.error).not.toHaveProperty("message");
          // Only what ServiceError allows: a code, and optionally a reason, a field, a wait and a note for developers.
          const allowed = ["code", "reason", "field", "retryAfterSeconds", "detail"];
          expect(Object.keys(failure.error).filter((key) => !allowed.includes(key))).toEqual([]);
          for (const optional of [failure.error.detail, failure.error.field, failure.error.reason]) {
            expect(["string", "undefined"]).toContain(typeof optional);
          }
        }
      });
    });
  });
}

describeContracts(
  "browser demo",
  {
    auth: authService,
    cases: caseService,
    documents: documentService,
    analysis: analysisService,
    chat: chatService,
    account: accountService,
  },
  {
    reset() {
      setFault(null);
      clearStore();
    },
    failReadings(on) {
      setFault(on ? "job_failed" : null);
    },
    async seedForeignCase() {
      const caseId = "case-somebody-elses";
      const documentId = "doc-somebody-elses";
      const at = "2026-09-01T08:00:00.000Z";
      updateStore((s) => ({
        ...s,
        cases: [
          ...s.cases,
          {
            id: caseId,
            citizenId: "user-somebody-else",
            title: "Somebody else's notice",
            category: "tenancy",
            source: "document_and_description",
            status: "ready",
            createdAt: at,
            updatedAt: at,
            isDemo: true,
          },
        ],
        documents: [
          ...s.documents,
          {
            id: documentId,
            caseId,
            fileName: "their-notice.pdf",
            mimeType: "application/pdf",
            byteSize: 900,
            kind: "pdf",
            uploadStatus: "local_only",
            createdAt: at,
          },
        ],
        descriptions: [...s.descriptions, { caseId, narrative: "Their landlord wants them to leave by the end of the month." }],
        chats: {
          ...s.chats,
          [caseId]: [{ id: "m-somebody-elses", caseId, role: "user", content: "Is this notice valid?", createdAt: at }],
        },
        jobs: { ...s.jobs, [caseId]: { id: "job-somebody-elses", startedAt: at, language: "en", outcome: "ready" } },
      }));
      return { caseId, documentId };
    },
  },
);

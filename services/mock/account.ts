import type { AccountExport } from "@/domain/account";
import { fail, ok, type Page, type Result } from "@/domain/result";
import type { User } from "@/domain/user";
import { isLocale } from "@/i18n/config";
import type { AccountService } from "@/services/types";
import { mockAnalysisService } from "./analysis";
import { mockCaseService } from "./cases";
import { mockChatService } from "./chat";
import { mockDocumentService } from "./documents";
import { clearSessionCookie, forgetEverything, signedIn } from "./session";
import { updateStore } from "./store";

const MAX_NAME_LENGTH = 80;

/** Reads every page of a list, in the order the pages come. Null if any page could not be read. */
async function everyPage<T>(page: (cursor?: string) => Promise<Result<Page<T>>>): Promise<T[][] | null> {
  const pages: T[][] = [];
  let cursor: string | undefined;
  do {
    const result = await page(cursor);
    if (!result.ok) return null;
    pages.push(result.data.items);
    cursor = result.data.nextCursor ?? undefined;
  } while (cursor);
  return pages;
}

export const mockAccountService: AccountService = {
  async updateProfile(changes) {
    const who = signedIn();
    if (!who.ok) return who;
    const displayName = changes.displayName?.trim();
    if (changes.displayName !== undefined && !displayName) {
      return fail("invalid", { reason: "empty", field: "displayName" });
    }
    if (displayName && displayName.length > MAX_NAME_LENGTH) {
      return fail("invalid", { reason: "too_long", field: "displayName" });
    }
    if (changes.preferredLanguage !== undefined && !isLocale(changes.preferredLanguage)) {
      return fail("invalid", { field: "preferredLanguage" });
    }
    const user: User = {
      ...who.data,
      displayName: displayName ?? who.data.displayName,
      preferredLanguage: changes.preferredLanguage ?? who.data.preferredLanguage,
    };
    updateStore((s) => ({ ...s, user }));
    return ok(user);
  },
  async exportData() {
    const who = signedIn();
    if (!who.ok) return who;
    // Goes through the same services the screens use, so only the person's own
    // data can come out. A part that cannot be read fails the whole export:
    // a file that claims to be everything must be everything.
    const incomplete = fail("unavailable");
    const records = await everyPage((cursor) => mockCaseService.list({ cursor, limit: 50 }));
    if (!records) return incomplete;

    const cases: AccountExport["cases"] = [];
    for (const record of records.flat()) {
      const story = await mockCaseService.getStory(record.id);
      const documents = await mockDocumentService.list(record.id);
      // The thread is paged from its end, so the pages are put back in time order.
      const questions = await everyPage((cursor) => mockChatService.list(record.id, { cursor, limit: 50 }));
      if (!story.ok || !documents.ok || !questions) return incomplete;
      const analysis = await mockAnalysisService.get(record.id);
      if (!analysis.ok && analysis.error.code !== "conflict") return incomplete;
      cases.push({
        record,
        story: story.data,
        documents: documents.data,
        analysis: analysis.ok ? analysis.data : null,
        questions: questions.reverse().flat(),
      });
    }
    return ok({ exportedAt: new Date().toISOString(), user: who.data, cases });
  },
  async deleteAccount() {
    const who = signedIn();
    if (!who.ok) return who;
    forgetEverything();
    clearSessionCookie();
    return ok(null);
  },
};

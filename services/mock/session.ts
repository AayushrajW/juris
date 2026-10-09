import { isDemoCase } from "@/data/mocks/locales";
import type { CaseId, CaseRecord } from "@/domain/case";
import { fail, ok, type Page, type PageParams, type Result } from "@/domain/result";
import type { User } from "@/domain/user";
import { clearBookmarks } from "@/lib/bookmarks";
import { SESSION_COOKIE } from "@/lib/constants";
import { clearNewCaseDraft } from "@/lib/drafts";
import { currentFault } from "./faults";
import { settleJobs } from "./jobs";
import { clearStore, dropMemory, loadStore, updateStore } from "./store";

const DEFAULT_PAGE = 20;
const MAX_PAGE = 50;

// ---- The session cookie. The proxy reads it; outside a browser there is none. ----

const inBrowser = () => typeof document !== "undefined";

export function writeSessionCookie(userId: string) {
  if (!inBrowser()) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax${secure}`;
}

export function clearSessionCookie() {
  if (!inBrowser()) return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

/** Whose session the cookie says this is. Outside a browser (tests) the stored user alone is the session. */
function cookieUserId(): string | null {
  if (!inBrowser()) return loadStore().user?.id ?? null;
  const part = document.cookie.split("; ").find((p) => p.startsWith(`${SESSION_COOKIE}=`));
  if (!part) return null;
  try {
    return decodeURIComponent(part.slice(SESSION_COOKIE.length + 1));
  } catch {
    return null;
  }
}

/** The person the session belongs to: the stored user, when the cookie names the same one. */
export function sessionUser(): User | null {
  let user = loadStore().user;
  if (user && cookieUserId() !== user.id) {
    // This tab may be holding on to an earlier person's data (storage was full,
    // so it stopped re-reading it). Let go of it and look at storage again.
    dropMemory();
    user = loadStore().user;
  }
  return user && cookieUserId() === user.id ? user : null;
}

/** Phones are shared. Leave nothing behind for the next person. */
export function forgetEverything() {
  clearStore();
  clearBookmarks();
  clearNewCaseDraft();
}

/** Starts a session, with the sample cases handed to the person who signed in. */
export function beginSession(user: User) {
  // Compared by email: it is what the person typed, and two people never share one.
  if (loadStore().user?.email !== user.email) forgetEverything();
  updateStore((s) => ({
    ...s,
    user,
    cases: s.cases.map((c) => (isDemoCase(c.id) ? { ...c, citizenId: user.id } : c)),
  }));
  writeSessionCookie(user.id);
}

// ---- Who is asking, and what is theirs. Every service starts here. ----

export function signedIn(): Result<User> {
  const fault = currentFault();
  if (fault && fault !== "job_failed") {
    return fail(fault, fault === "rate_limited" ? { retryAfterSeconds: 30 } : undefined);
  }
  const user = sessionUser();
  if (!user) return fail("unauthenticated");
  settleJobs();
  return ok(user);
}

/** The case, if it exists and belongs to the person asking. Otherwise "not_found". */
export function ownedCase(caseId: CaseId): Result<CaseRecord> {
  const who = signedIn();
  if (!who.ok) return who;
  const found = loadStore().cases.find((c) => c.id === caseId && c.citizenId === who.data.id);
  return found ? ok(found) : fail("not_found");
}

// ---- Pages ----
//
// A cursor names an item, not a position: the last one of the page before.
// Something added or removed between two requests therefore never makes the
// next page repeat an item or skip one. It is wrapped so no screen can build one.

type CursorKind = "after" | "before";

const encodeCursor = (kind: CursorKind, key: string) => btoa(`${kind}:${key}`);

function decodeCursor(kind: CursorKind, cursor: string): string | null {
  try {
    const text = atob(cursor);
    const prefix = `${kind}:`;
    return text.startsWith(prefix) && text.length > prefix.length ? text.slice(prefix.length) : null;
  } catch {
    return null;
  }
}

const badCursor = () => fail("invalid", { reason: "bad_cursor", field: "cursor" });

function pageSize(limit: number | undefined) {
  const asked = typeof limit === "number" && Number.isFinite(limit) ? Math.trunc(limit) : DEFAULT_PAGE;
  return Math.min(Math.max(asked, 1), MAX_PAGE);
}

/** Largest key first. Plain comparison, the same one `paginate` uses to find its place. */
export function newestFirst<T>(items: T[], keyOf: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const [ka, kb] = [keyOf(a), keyOf(b)];
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });
}

/** Cuts a list ordered by `newestFirst` into the page asked for. */
export function paginate<T>(
  items: T[],
  params: PageParams | undefined,
  keyOf: (item: T) => string,
): Result<Page<T>> {
  let start = 0;
  if (params?.cursor !== undefined) {
    const last = decodeCursor("after", params.cursor);
    if (last === null) return badCursor();
    const next = items.findIndex((item) => keyOf(item) < last);
    start = next === -1 ? items.length : next;
  }
  const page = items.slice(start, start + pageSize(params?.limit));
  const more = start + page.length < items.length;
  return ok({ items: page, nextCursor: more ? encodeCursor("after", keyOf(page[page.length - 1])) : null });
}

/**
 * For a conversation, which is read from its end: the page holds the latest
 * messages, oldest first, and the cursor names the oldest one on the page,
 * leading to the messages before it.
 */
export function paginateFromEnd<T>(
  items: T[],
  params: PageParams | undefined,
  idOf: (item: T) => string,
): Result<Page<T>> {
  let end = items.length;
  if (params?.cursor !== undefined) {
    const oldest = decodeCursor("before", params.cursor);
    end = oldest === null ? -1 : items.findIndex((item) => idOf(item) === oldest);
    if (end === -1) return badCursor();
  }
  const start = Math.max(0, end - pageSize(params?.limit));
  const page = items.slice(start, end);
  return ok({ items: page, nextCursor: start > 0 ? encodeCursor("before", idOf(page[0])) : null });
}

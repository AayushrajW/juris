import { DEMO_ANALYSES } from "@/data/mocks/analyses";
import { DEMO_CASES, DEMO_DESCRIPTIONS, DEMO_DOCUMENTS } from "@/data/mocks/cases";
import { DEMO_USER } from "@/data/mocks/user";
import type { CaseAnalysis } from "@/domain/analysis";
import type { CaseRecord } from "@/domain/case";
import type { ChatMessage } from "@/domain/chat";
import type { ProblemDescription, UploadedDocument } from "@/domain/document";
import type { LawyerThread } from "@/domain/thread";
import type { User } from "@/domain/user";
import { DEMO_LAWYER_THREADS } from "@/data/mocks/lawyerChats";
import { daysSinceReference, shiftDates } from "@/data/mocks/rebase";

const STORAGE_KEY = "juris-mock-v1";

export interface MockStore {
  user: User | null;
  cases: CaseRecord[];
  documents: UploadedDocument[];
  descriptions: ProblemDescription[];
  analyses: Record<string, CaseAnalysis>;
  chats: Record<string, ChatMessage[]>;
  lawyerThreads: LawyerThread[];
}

function seed(): MockStore {
  // shiftDates copies as it goes, so the fixtures themselves are never mutated.
  return shiftDates(
    {
      user: null,
      cases: DEMO_CASES,
      documents: DEMO_DOCUMENTS,
      descriptions: DEMO_DESCRIPTIONS,
      analyses: DEMO_ANALYSES,
      chats: {},
      lawyerThreads: DEMO_LAWYER_THREADS,
    },
    daysSinceReference(),
  );
}

let memory = seed();

function canUseStorage() {
  return typeof window !== "undefined";
}

export function loadStore(): MockStore {
  if (!canUseStorage()) {
    return memory;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memory = seed();
      return memory;
    }
    const parsed = JSON.parse(raw) as MockStore;
    memory = {
      ...seed(),
      ...parsed,
      cases: parsed.cases?.length ? parsed.cases : seed().cases,
      analyses: { ...seed().analyses, ...parsed.analyses },
      lawyerThreads: parsed.lawyerThreads?.length ? parsed.lawyerThreads : seed().lawyerThreads,
    };
    return memory;
  } catch {
    memory = seed();
    return memory;
  }
}

export function saveStore(next: MockStore) {
  memory = next;
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private browsing). The session carries on from memory.
  }
}

export function updateStore(updater: (current: MockStore) => MockStore): MockStore {
  const next = updater(loadStore());
  saveStore(next);
  return next;
}

/** Removes everything this browser holds, so the next person starts clean. */
export function clearStore() {
  memory = seed();
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to remove if storage is blocked.
  }
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return local ? local.replace(/\b\p{L}/gu, (ch) => ch.toUpperCase()) : "";
}

export function demoUserFromName(name: string | undefined, email: string): User {
  const cleanEmail = email.trim() || DEMO_USER.email;
  const isDemoAccount = cleanEmail.toLowerCase() === DEMO_USER.email;
  return {
    ...DEMO_USER,
    displayName:
      name?.trim() ||
      (isDemoAccount ? DEMO_USER.displayName : nameFromEmail(cleanEmail)) ||
      DEMO_USER.displayName,
    email: cleanEmail,
  };
}

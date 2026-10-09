import { DEMO_CASES, DEMO_DOCUMENTS } from "@/data/mocks/cases";
import { DEMO_LAWYER_THREADS } from "@/data/mocks/lawyerChats";
import { DEMO_USER } from "@/data/mocks/user";
import type { CaseRecord } from "@/domain/case";
import type { ChatMessage } from "@/domain/chat";
import type { ProblemDescription, UploadedDocument } from "@/domain/document";
import type { LawyerThread } from "@/domain/thread";
import type { User } from "@/domain/user";

const STORAGE_KEY = "juris-mock-v2";
/** Keys used by earlier builds. They may still hold someone's data, so they are removed. */
const RETIRED_KEYS = ["juris-mock-v1"];

/** Which scripted reply the demo assistant gave. The words are rebuilt in the page's language. */
export type DemoReplyKind = "person" | "date" | "next" | "overview";

export type StoredChatMessage = ChatMessage & { demoReply?: DemoReplyKind };

/**
 * What the demo keeps in the browser. Explanations and the assistant's replies
 * are not stored as text: they are built on request in whichever language the
 * page is showing.
 */
export interface MockStore {
  user: User | null;
  cases: CaseRecord[];
  documents: UploadedDocument[];
  /** Stories for cases the visitor created. Sample stories live with the sample content. */
  descriptions: ProblemDescription[];
  chats: Record<string, StoredChatMessage[]>;
  lawyerThreads: LawyerThread[];
}

function seed(): MockStore {
  return {
    user: null,
    cases: structuredClone(DEMO_CASES),
    documents: structuredClone(DEMO_DOCUMENTS),
    descriptions: [],
    chats: {},
    lawyerThreads: structuredClone(DEMO_LAWYER_THREADS),
  };
}

let memory = seed();

function canUseStorage() {
  return typeof window !== "undefined";
}

function removeKeys(keys: string[]) {
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to remove if storage is blocked.
    }
  }
}

export function loadStore(): MockStore {
  if (!canUseStorage()) {
    return memory;
  }
  removeKeys(RETIRED_KEYS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memory = seed();
      return memory;
    }
    const parsed = JSON.parse(raw) as Partial<MockStore>;
    const fresh = seed();
    memory = {
      ...fresh,
      ...parsed,
      cases: parsed.cases?.length ? parsed.cases : fresh.cases,
      lawyerThreads: parsed.lawyerThreads?.length ? parsed.lawyerThreads : fresh.lawyerThreads,
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
  removeKeys([STORAGE_KEY, ...RETIRED_KEYS]);
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

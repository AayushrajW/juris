import { DEMO_CASES, DEMO_DOCUMENTS } from "@/data/mocks/cases";
import { DEMO_LAWYER_THREADS } from "@/data/mocks/lawyerChats";
import { DEMO_USER } from "@/data/mocks/user";
import type { CaseRecord } from "@/domain/case";
import type { ChatMessage } from "@/domain/chat";
import type { ProblemDescription, UploadedDocument } from "@/domain/document";
import type { LawyerThread } from "@/domain/thread";
import type { LanguageCode, User } from "@/domain/user";

const STORAGE_KEY = "juris-mock-v4";
/** Keys used by earlier builds. They may still hold someone's data, so they are removed. */
const RETIRED_KEYS = ["juris-mock-v1", "juris-mock-v2", "juris-mock-v3"];

/** Which scripted reply the demo assistant gave. The words are rebuilt in the page's language. */
export type DemoReplyKind = "person" | "date" | "next" | "overview";

export type StoredChatMessage = ChatMessage & {
  demoReply?: DemoReplyKind;
  /** Set on a question so that a retry of the same request is not answered twice. */
  requestId?: string;
  /** The language a reply was given in. It stays in that language. */
  language?: LanguageCode;
};

/** One reading of a case. Its progress is worked out from the clock until it has an outcome. */
export interface StoredJob {
  id: string;
  startedAt: string;
  language: LanguageCode;
  outcome?: "ready" | "failed";
  /**
   * Set when the case already had an explanation as this reading began: the
   * language of that explanation, which stays in place unless this one succeeds.
   */
  kept?: LanguageCode;
}

/** What a request with an id made, and a print of what was sent, to tell a retry from a reuse. */
export interface StoredRequest {
  made: string;
  print: string;
}

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
  /** The latest reading of each case, by case id. */
  jobs: Record<string, StoredJob>;
  /** What each request that carried an id made, so a retry makes no second one. */
  requests: Record<string, StoredRequest>;
  lawyerThreads: LawyerThread[];
}

function seed(): MockStore {
  return {
    user: null,
    cases: structuredClone(DEMO_CASES),
    documents: structuredClone(DEMO_DOCUMENTS),
    descriptions: [],
    chats: {},
    jobs: {},
    requests: {},
    lawyerThreads: structuredClone(DEMO_LAWYER_THREADS),
  };
}

let memory = seed();
/** True while memory is a copy of what storage holds. */
let mirrored = false;
/** True after storage refused a write. From then on memory is the only full copy. */
let storageRefused = false;

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
  if (!canUseStorage() || storageRefused) return memory;
  removeKeys(RETIRED_KEYS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Another tab signed out and cleared storage. What this tab still
      // remembers belongs to that person, so it goes too.
      if (mirrored) memory = seed();
      mirrored = false;
      return memory;
    }
    // Missing parts are filled in from a fresh seed, so an older shape still loads.
    memory = { ...seed(), ...(JSON.parse(raw) as Partial<MockStore>) };
    mirrored = true;
    return memory;
  } catch {
    memory = seed();
    mirrored = false;
    return memory;
  }
}

export function saveStore(next: MockStore) {
  memory = next;
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    mirrored = true;
    storageRefused = false;
  } catch {
    // Storage full or blocked (private browsing). The session carries on from
    // memory, which loadStore stops replacing with the older stored copy.
    storageRefused = true;
  }
}

export function updateStore(updater: (current: MockStore) => MockStore): MockStore {
  const next = updater(loadStore());
  saveStore(next);
  return next;
}

/**
 * Lets go of what this tab remembers without touching storage, so the next
 * read comes from storage again. For a tab found holding someone else's data.
 */
export function dropMemory() {
  memory = seed();
  mirrored = false;
  storageRefused = false;
}

/** Removes everything this browser holds, so the next person starts clean. */
export function clearStore() {
  memory = seed();
  mirrored = false;
  storageRefused = false;
  if (!canUseStorage()) return;
  removeKeys([STORAGE_KEY, ...RETIRED_KEYS]);
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return local ? local.replace(/\b\p{L}/gu, (ch) => ch.toUpperCase()) : "";
}

/** A stable id per email, so two people are never the same user. */
function idFromEmail(email: string) {
  let hash = 5381;
  for (const ch of email) hash = ((hash * 33) ^ ch.codePointAt(0)!) >>> 0;
  return `user-${hash.toString(36)}`;
}

export function demoUserFromName(
  name: string | undefined,
  email: string,
  language: LanguageCode,
): User {
  const cleanEmail = email.trim().toLowerCase() || DEMO_USER.email;
  const isDemoAccount = cleanEmail === DEMO_USER.email;
  return {
    id: isDemoAccount ? DEMO_USER.id : idFromEmail(cleanEmail),
    role: "citizen",
    displayName:
      name?.trim() ||
      (isDemoAccount ? DEMO_USER.displayName : nameFromEmail(cleanEmail)) ||
      DEMO_USER.displayName,
    email: cleanEmail,
    preferredLanguage: language,
  };
}

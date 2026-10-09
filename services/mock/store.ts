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
  return {
    user: null,
    cases: structuredClone(DEMO_CASES),
    documents: structuredClone(DEMO_DOCUMENTS),
    descriptions: structuredClone(DEMO_DESCRIPTIONS),
    analyses: structuredClone(DEMO_ANALYSES),
    chats: {},
    lawyerThreads: structuredClone(DEMO_LAWYER_THREADS),
  };
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
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
}

export function updateStore(updater: (current: MockStore) => MockStore): MockStore {
  const next = updater(loadStore());
  saveStore(next);
  return next;
}

export function demoUserFromName(name: string, email: string): User {
  return {
    ...DEMO_USER,
    displayName: name.trim() || DEMO_USER.displayName,
    email: email.trim() || DEMO_USER.email,
  };
}

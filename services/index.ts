import { fail } from "@/domain/result";
import { reportSessionEnded } from "@/lib/sessionEvents";
import { mockAccountService } from "./mock/account";
import { mockAnalysisService } from "./mock/analysis";
import { mockAuthService } from "./mock/auth";
import { mockCaseService } from "./mock/cases";
import { mockChatService } from "./mock/chat";
import { mockDocumentService } from "./mock/documents";
import { mockLawyerChatService } from "./mock/lawyerChat";
import { mockLawyerRepository } from "./mock/lawyers";
import type {
  AccountService,
  AnalysisService,
  AuthService,
  CaseService,
  ChatService,
  DocumentService,
  LawyerChatService,
  LawyerRepository,
} from "./types";

function saysSessionEnded(result: unknown) {
  if (typeof result !== "object" || result === null || !("error" in result)) return false;
  const { error } = result as { error?: { code?: unknown } };
  return error?.code === "unauthenticated";
}

/**
 * Keeps the two promises every screen relies on, whichever implementation is
 * behind a service: it never throws (a dropped connection comes back as
 * "unavailable"), and a session that has ended is noticed at once, so the
 * person is sent to sign in and is not left looking at an error.
 */
function guarded<T extends object>(service: T): T {
  return new Proxy(service, {
    get(target, key, receiver) {
      const member: unknown = Reflect.get(target, key, receiver);
      if (typeof member !== "function") return member;
      return async (...args: unknown[]) => {
        try {
          const result: unknown = await member.apply(target, args);
          if (saysSessionEnded(result)) reportSessionEnded();
          return result;
        } catch {
          return fail("unavailable");
        }
      };
    },
  });
}

/**
 * The one place that decides which implementation the screens talk to.
 *
 * Today every service is the browser-only demo. The real ones will run on the
 * server and be reached from here through thin clients that call it; the
 * contracts in ./types.ts stay the same.
 */
export const authService: AuthService = guarded(mockAuthService);
export const caseService: CaseService = guarded(mockCaseService);
export const documentService: DocumentService = guarded(mockDocumentService);
export const analysisService: AnalysisService = guarded(mockAnalysisService);
export const chatService: ChatService = guarded(mockChatService);
export const accountService: AccountService = guarded(mockAccountService);
export const lawyerRepository: LawyerRepository = guarded(mockLawyerRepository);
export const lawyerChatService: LawyerChatService = guarded(mockLawyerChatService);

import type { AccountExport } from "@/domain/account";
import type { AnalysisJob, CaseAnalysis, UpcomingDeadline } from "@/domain/analysis";
import type { CaseId, CaseRecord, CaseSource, CaseStatus, MatterCategory } from "@/domain/case";
import type { ChatMessage } from "@/domain/chat";
import type { DocumentId, DocumentListing, ProblemDescription, UploadedDocument } from "@/domain/document";
import type { LawyerFilters, LawyerId, LawyerProfile } from "@/domain/lawyer";
import type { Page, PageParams, Result } from "@/domain/result";
import type { LawyerMessage, LawyerThread } from "@/domain/thread";
import type { LanguageCode, User } from "@/domain/user";

/*
 * What the screens may ask for.
 *
 * A service never throws. Whatever goes wrong, a dropped connection included,
 * comes back as a failure (services/index.ts sees to it), so a screen has one
 * path to handle and no button is left waiting.
 *
 * No method takes a user id. Each service works out who is asking from the
 * session, so a screen cannot ask on someone else's behalf, and something that
 * belongs to another person is reported as "not_found".
 *
 * Failures are codes (domain/result.ts) that screens put into words. "not_found"
 * always means the thing is not there for this person; something that is there
 * but cannot be used yet is "conflict" with a reason.
 *
 * The same contract tests (tests/contracts.test.ts) run against every
 * implementation.
 */

/**
 * Makes a retry safe. The same id sent again with the same contents returns
 * what the first request made; sent again with different contents it is
 * "conflict" (request_reused), so a screen takes a new id whenever the person
 * changes what they are sending.
 */
export interface RequestOptions {
  requestId?: string;
}

/** A one-time code on its way to a phone. */
export interface CodeChallenge {
  challengeId: string;
  /** The number the code went to, in international form. */
  phone: string;
  /** How long to wait before another code may be asked for. */
  resendAfterSeconds: number;
  expiresAt: string;
  /** Demo only: the code itself, since no message is really sent. A real service never sets it. */
  demoCode?: string;
}

/*
 * Signing in is a mobile number and a one-time code. There is no separate
 * "sign up": the first time a number is used, checking its code makes the
 * account. There are no passwords to forget.
 *
 * What a real service must do that the contract tests cannot see from outside
 * (the demo does none of it, because it sends no messages and holds no data):
 *
 * - Count wrong codes per NUMBER, across challenges, not only per code: a new
 *   code every thirty seconds must not buy five more guesses for ever.
 * - Cap the codes sent per number per day, and the numbers asked for per
 *   device and per network address, and stop sending altogether above a
 *   spending ceiling. Otherwise a script can run up the SMS bill or pester a
 *   stranger. A daily cap is "quota_exceeded"; a short wait is "rate_limited".
 * - Let a code be checked only by the browser that asked for it.
 * - Whenever it answers that nobody is signed in, also remove the session
 *   cookie, in the same response. A cookie left behind sends the person round
 *   in circles between the sign-in page and the page they wanted.
 * - Never put the code in an answer. `demoCode` exists for the demo alone.
 */
export interface AuthService {
  /**
   * Sends a one-time code to an Indian mobile number, typed in any usual way.
   * Something that is not such a number is "invalid" (field "phone"). Asking
   * for the same number again too soon is "rate_limited", with how long to
   * wait, even when the code before it has been used up or thrown away.
   * `language` is the one to write the message in: nobody is signed in yet, so
   * the service cannot know it otherwise.
   */
  requestCode(phone: string, options?: { language?: LanguageCode }): Promise<Result<CodeChallenge>>;
  /**
   * Checks the code and starts a session. A code that does not match is
   * "invalid" (wrong_code, field "code") and may be typed again. One that is
   * too old, already used, or was got wrong too many times is "invalid"
   * (code_expired, field "code"): a new code has to be asked for.
   */
  verifyCode(challengeId: string, code: string): Promise<Result<User>>;
  signOut(): Promise<Result<null>>;
  /** Who is signed in, or null. A failure means it could not be checked, not that nobody is. */
  getSession(): Promise<Result<User | null>>;
}

export interface CreateCaseInput {
  title: string;
  category: MatterCategory;
  source: CaseSource;
  city?: string;
  state?: string;
  /** What the person wrote. Papers are added afterwards with DocumentService.upload. */
  story?: Omit<ProblemDescription, "caseId">;
}

/** The parts of a case a person may correct afterwards. Leave out what stays the same. */
export interface CaseChanges {
  title?: string;
  category?: MatterCategory;
  city?: string;
  state?: string;
}

export interface CaseService {
  /**
   * Newest first by when each case was made. The order does not change while
   * paging, so no case is shown twice or skipped.
   */
  list(params?: PageParams & { status?: CaseStatus | CaseStatus[] }): Promise<Result<Page<CaseRecord>>>;
  get(caseId: CaseId): Promise<Result<CaseRecord>>;
  /** What the person wrote about it, if anything. */
  getStory(caseId: CaseId): Promise<Result<ProblemDescription | null>>;
  /** Makes a draft. Nothing is read until AnalysisService.start is called. */
  create(input: CreateCaseInput, options?: RequestOptions): Promise<Result<CaseRecord>>;
  update(caseId: CaseId, changes: CaseChanges): Promise<Result<CaseRecord>>;
  /** Removes the case with its papers, story, explanation and questions. */
  remove(caseId: CaseId): Promise<Result<null>>;
  /**
   * Dates that have not passed yet, across every finished case, nearest first.
   * Three unless `limit` asks for more.
   */
  upcomingDeadlines(params?: { limit?: number }): Promise<Result<UpcomingDeadline[]>>;
}

export interface DocumentService {
  list(caseId: CaseId): Promise<Result<UploadedDocument[]>>;
  /** Every paper the person has added, newest first. */
  listAll(params?: PageParams): Promise<Result<Page<DocumentListing>>>;
  /**
   * Takes the file itself. The service checks its type and size: a wrong type
   * is "invalid" and a file that is too big is "too_large", both with field "file".
   */
  upload(caseId: CaseId, file: File, options?: RequestOptions): Promise<Result<UploadedDocument>>;
  remove(documentId: DocumentId): Promise<Result<null>>;
}

export interface StartAnalysisOptions {
  /** The language to write the explanation in. The person's own language when left out. */
  language?: LanguageCode;
  /** Read the case again although it has an explanation: after a new paper, or in another language. */
  rerun?: boolean;
}

export interface AnalysisService {
  /**
   * Asks for the case to be read. Returns at once: the work carries on in the
   * background, even if the person closes the page, and the case's status
   * changes by itself when it is done.
   *
   * While a reading is running, asking again returns that same job. A new one
   * starts when there has been none, when the last one failed, or when `rerun`
   * is set; otherwise the finished job is returned. A case with no paper and
   * no story is "conflict" (nothing_to_read).
   *
   * Reading a case again never takes away what the person already has: the
   * earlier explanation stays, and the case keeps its status, until the new
   * reading succeeds. If it fails, the earlier explanation is still there.
   */
  start(caseId: CaseId, options?: StartAnalysisOptions): Promise<Result<AnalysisJob>>;
  /** The latest reading of the case, or null if it has never been asked for. Safe to ask often. */
  status(caseId: CaseId): Promise<Result<AnalysisJob | null>>;
  /**
   * The latest finished explanation. When there is none this is "conflict",
   * with the reason "never_started", "not_ready" (the first reading is still
   * running) or "reading_failed".
   */
  get(caseId: CaseId): Promise<Result<CaseAnalysis>>;
}

export interface ChatService {
  /**
   * The latest messages, oldest first within the page. `nextCursor` leads to
   * the messages before them.
   */
  list(caseId: CaseId, params?: PageParams): Promise<Result<Page<ChatMessage>>>;
  /**
   * Sends a question and returns the new messages: the question, then the
   * reply. Screens should always send a `requestId`: the same id sent again
   * returns the first answer instead of asking twice, and the same id with a
   * different question is "conflict" (request_reused). A case with no
   * explanation is "conflict", for the same reasons as AnalysisService.get.
   */
  send(
    caseId: CaseId,
    content: string,
    options?: RequestOptions & { language?: LanguageCode },
  ): Promise<Result<ChatMessage[]>>;
}

export interface ProfileChanges {
  displayName?: string;
  preferredLanguage?: LanguageCode;
}

export interface AccountService {
  updateProfile(changes: ProfileChanges): Promise<Result<User>>;
  /** Everything held about the person who is signed in. Fails rather than return a part of it. */
  exportData(): Promise<Result<AccountExport>>;
  /** Removes the person and everything held about them, and ends the session. */
  deleteAccount(): Promise<Result<null>>;
}

// Advocate features. Switched off (see lib/env.ts) and not yet redesigned.

export interface LawyerRepository {
  list(filters?: LawyerFilters): Promise<Result<LawyerProfile[]>>;
  getById(id: LawyerId): Promise<Result<LawyerProfile>>;
}

export interface LawyerChatService {
  listThreads(): Promise<Result<LawyerThread[]>>;
  list(lawyerId: LawyerId): Promise<Result<LawyerMessage[]>>;
  send(lawyerId: LawyerId, content: string): Promise<Result<LawyerMessage[]>>;
  markRead(lawyerId: LawyerId): Promise<Result<LawyerThread[]>>;
}

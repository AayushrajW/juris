/**
 * Why a request failed. Screens choose their own translated wording from the
 * code (see the "errors" messages); they never show text from a service.
 */
export type ErrorCode =
  /** Nobody is signed in, or the session has ended. */
  | "unauthenticated"
  /** Signed in, but not allowed to do this. */
  | "forbidden"
  /** It does not exist, or it belongs to someone else. The two are not told apart on purpose. */
  | "not_found"
  /** What was sent is not acceptable. `field` says which input, when there is one. */
  | "invalid"
  /** It exists, but is not in a state where this can be done. `reason` says why. */
  | "conflict"
  /** What was sent is bigger than is allowed. */
  | "too_large"
  /** Too many requests in a short time. Waiting `retryAfterSeconds` helps. */
  | "rate_limited"
  /** The allowance for the day is used up. Trying again soon will not help. */
  | "quota_exceeded"
  /** Something is down. Trying again later may work. */
  | "unavailable";

/** Narrows a code when the screen needs to choose between different words or actions. */
export type ErrorReason =
  | "empty"
  | "too_short"
  | "too_long"
  | "file_type"
  | "file_size"
  | "bad_cursor"
  /** The explanation is still being written. */
  | "not_ready"
  /** Nobody has asked for the case to be read yet. */
  | "never_started"
  /** The reading stopped without an explanation. Asking for it again may work. */
  | "reading_failed"
  /** The case has no paper and no story, so there is nothing to explain. */
  | "nothing_to_read"
  /** A request id was sent again with different contents. */
  | "request_reused";

export interface ServiceError {
  code: ErrorCode;
  reason?: ErrorReason;
  /** Which input was wrong, for "invalid" and "too_large". */
  field?: string;
  /** How long to wait before trying again, when the service knows. */
  retryAfterSeconds?: number;
  /** For logs and developers only. Never shown to people. */
  detail?: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ServiceError };

export interface Page<T> {
  items: T[];
  /** Send this back as `cursor` for the next page. Null on the last page. */
  nextCursor: string | null;
}

export interface PageParams {
  /** The `nextCursor` of the page before. A screen cannot build one itself. */
  cursor?: string;
  /** How many to return: 20 when left out, and never more than 50 whatever is asked. */
  limit?: number;
}

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, extra?: Omit<ServiceError, "code">): Result<never> {
  return { ok: false, error: { code, ...extra } };
}

import type { ErrorCode } from "@/domain/result";

/*
 * The demo never goes wrong by itself, so the screens' error paths would go
 * untried. This switch makes it go wrong on purpose. In the browser console:
 *
 *   sessionStorage.setItem("juris-mock-fault", "unavailable")   any error code
 *   sessionStorage.setItem("juris-mock-fault", "job_failed")    readings fail
 *   sessionStorage.removeItem("juris-mock-fault")               back to normal
 */
const FAULT_KEY = "juris-mock-fault";

const CODES: readonly ErrorCode[] = [
  "unauthenticated",
  "forbidden",
  "not_found",
  "invalid",
  "conflict",
  "too_large",
  "rate_limited",
  "quota_exceeded",
  "unavailable",
];

export type Fault = ErrorCode | "job_failed";

let forced: Fault | null = null;

/** Sets the fault from code. Tests use this, as they have no browser console. Null goes back to normal. */
export function setFault(fault: Fault | null) {
  forced = fault;
}

export function currentFault(): Fault | null {
  if (forced) return forced;
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(FAULT_KEY);
    if (value === "job_failed") return value;
    return CODES.find((code) => code === value) ?? null;
  } catch {
    return null;
  }
}

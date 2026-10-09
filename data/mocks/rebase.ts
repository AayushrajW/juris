const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The day the demo fixtures treat as "today". */
export const DEMO_REFERENCE_DAY = "2026-08-18";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function shiftDay(match: RegExpExecArray, days: number) {
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days from the reference day to `now`, counted in local calendar days. */
export function daysSinceReference(now: Date = new Date()): number {
  const ref = ISO_DAY.exec(DEMO_REFERENCE_DAY)!;
  const start = new Date(Number(ref[1]), Number(ref[2]) - 1, Number(ref[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - start.getTime()) / DAY_MS);
}

/**
 * Returns a deep copy of `value` with every ISO date moved by `days`. The demo
 * uses this so its sample deadlines are always a few days ahead, never stale.
 */
export function shiftDates<T>(value: T, days: number): T {
  if (typeof value === "string") {
    const day = ISO_DAY.exec(value);
    if (day) return shiftDay(day, days) as T;
    if (ISO_INSTANT.test(value)) {
      return new Date(new Date(value).getTime() + days * DAY_MS).toISOString() as T;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => shiftDates(item, days)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, shiftDates(item, days)]),
    ) as T;
  }
  return value;
}

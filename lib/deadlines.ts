import { daysUntil } from "@/lib/format";

export type DeadlineState = "none" | "passed" | "urgent" | "soon" | "upcoming";

const URGENT_WITHIN_DAYS = 3;
const SOON_WITHIN_DAYS = 14;

/** Urgency is worked out from the date each time, so it stays right as days go by. */
export function deadlineState(date: string | undefined, today: Date = new Date()): DeadlineState {
  const days = daysUntil(date, today);
  if (days === null) return "none";
  if (days < 0) return "passed";
  if (days <= URGENT_WITHIN_DAYS) return "urgent";
  if (days <= SOON_WITHIN_DAYS) return "soon";
  return "upcoming";
}

/**
 * What to say about how far away a date is: the `deadline.left` or
 * `deadline.ago` message and the values it needs. Null when there is no date.
 *
 * `days` picks the wording (today, tomorrow, N days). `count` is the same
 * number as text: a number would be shown in the language's own digits, and
 * every date in the app uses Western digits to match the papers people bring.
 */
export function daysLeftParts(
  date: string | undefined,
  today: Date = new Date(),
): { key: "left" | "ago"; values: { days: number; count: string } } | null {
  const until = daysUntil(date, today);
  if (until === null) return null;
  const days = Math.abs(until);
  return { key: until >= 0 ? "left" : "ago", values: { days, count: String(days) } };
}

/** The nearest date that has not passed yet, if there is one. */
export function nextDeadline<T extends { date?: string }>(
  items: T[],
  today: Date = new Date(),
): T | null {
  let best: T | null = null;
  let bestDays = Infinity;
  for (const item of items) {
    const days = daysUntil(item.date, today);
    if (days === null || days < 0) continue;
    if (days < bestDays) {
      best = item;
      bestDays = days;
    }
  }
  return best;
}

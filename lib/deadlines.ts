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

export const DEADLINE_STATE_LABEL: Record<DeadlineState, string> = {
  none: "No date given",
  passed: "Date has passed",
  urgent: "Very soon",
  soon: "Soon",
  upcoming: "Later",
};

/** "Today", "Tomorrow", "9 days left" or "3 days ago". Null when there is no date. */
export function daysLeftText(date: string | undefined, today: Date = new Date()): string | null {
  const days = daysUntil(date, today);
  if (days === null) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `${days} days left`;
  if (days === -1) return "Yesterday";
  return `${-days} days ago`;
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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** A calendar day `days` from today, as an ISO date. */
export function isoDayFromToday(days: number, today: Date = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Dates used by the sample cases, shared by every language.
 * The rent notice gives 15 days and the sample reader is six days in, so the
 * leaving date is always nine days ahead and the demo never goes stale.
 */
export const DEMO_DATES = {
  vacate: isoDayFromToday(9),
  /** Fixed: 24 months after the purchase date printed on the sample card. */
  warrantyEnd: "2027-03-03",
};

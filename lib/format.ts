import type { Locale } from "@/i18n/config";

/**
 * Month names are written out here instead of taken from the browser. The
 * server and each phone carry different built-in language data, so the same
 * date could otherwise read differently in two places.
 */
const MONTHS: Record<Locale, readonly string[]> = {
  mr: ["जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून", "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"],
  hi: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** A date-only string ("2026-08-27") means that calendar day here, not midnight UTC. */
function parseDate(iso: string): Date {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(iso);
}

/**
 * "27 August 2026" in the reader's language, with Western digits as printed
 * on the papers people bring. Null when there is no readable date.
 */
export function formatDate(iso: string | undefined, locale: Locale): string | null {
  if (!iso) return null;
  const date = parseDate(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getDate()} ${MONTHS[locale][date.getMonth()]} ${date.getFullYear()}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function firstName(displayName?: string | null): string {
  return displayName?.trim().split(/\s+/)[0] ?? "";
}

/** The first letter as a reader sees it. In Devanagari that can be several code points. */
function firstLetter(word: string): string {
  if (typeof Intl.Segmenter === "function") {
    const first = new Intl.Segmenter(undefined, { granularity: "grapheme" })
      .segment(word)
      [Symbol.iterator]()
      .next();
    return first.done ? "" : first.value.segment;
  }
  return Array.from(word)[0] ?? "";
}

export function initials(displayName?: string | null): string {
  if (!displayName) return "U";
  // "Adv. Kavita Sharma" is KS, not AS.
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter((part) => part && !/^adv\.?$/i.test(part));
  if (parts.length === 0) return "U";
  if (parts.length === 1) return firstLetter(parts[0]).toUpperCase();
  return `${firstLetter(parts[0])}${firstLetter(parts[parts.length - 1])}`.toUpperCase();
}

export function formatInr(amount?: number): string {
  if (amount == null) return "Fee on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Whole calendar days from `today` to the date. Negative when the date has passed. */
export function daysUntil(iso?: string, today: Date = new Date()): number | null {
  if (!iso) return null;
  const date = parseDate(iso);
  if (Number.isNaN(date.getTime())) return null;
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const to = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

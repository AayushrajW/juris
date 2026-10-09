const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** A date-only string ("2026-08-27") means that calendar day here, not midnight UTC. */
function parseDate(iso: string): Date {
  const day = /^(d{4})-(d{2})-(d{2})$/.exec(iso);
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(iso);
}

export function formatDate(iso?: string): string {
  if (!iso) return "Date not known";
  const date = parseDate(iso);
  if (Number.isNaN(date.getTime())) return "Date not known";
  return dateFormatter.format(date);
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "Time not known";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Time not known";
  return dateTimeFormatter.format(date);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function firstName(displayName?: string | null): string {
  if (!displayName) return "there";
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

export function initials(displayName?: string | null): string {
  if (!displayName) return "U";
  // "Adv. Kavita Sharma" is KS, not AS.
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter((part) => part && !/^adv\.?$/i.test(part));
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function greetingForNow(displayName?: string | null): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${firstName(displayName)}!`;
}

export function formatRelative(iso?: string): string {
  if (!iso) return "Updated recently";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Updated recently";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "Updated 1 hour ago" : `Updated ${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Updated yesterday";
  if (days < 14) return `Updated ${days} days ago`;
  return `Updated ${formatDate(iso)}`;
}

export function formatInr(amount?: number): string {
  if (amount == null) return "Fee on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function publicCaseRef(id: string): string {
  const hash = [...id].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  return `NS-${String(1000 + (hash % 9000)).padStart(4, "0")}`;
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

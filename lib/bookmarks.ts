const KEY = "juris-lawyer-bookmarks";

export function listBookmarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function isBookmarked(id: string): boolean {
  return listBookmarks().includes(id);
}

export function toggleBookmark(id: string): boolean {
  const current = listBookmarks();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return current.includes(id);
  }
  return next.includes(id);
}

export function clearBookmarks() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to remove if storage is blocked.
  }
}

const KEY = "juris-lawyer-bookmarks";

export function listBookmarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
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
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next.includes(id);
}

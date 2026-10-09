const PLACEHOLDER_ORIGIN = "http://juris.invalid";

/**
 * Returns `next` only when it is a path on this site. Anything that could send
 * the browser elsewhere ("https://…", "//host", "/\host", "javascript:…")
 * falls back.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Browsers strip tabs and newlines from URLs, which can turn "/\t/host" into "//host".
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    if (new URL(next, PLACEHOLDER_ORIGIN).origin !== PLACEHOLDER_ORIGIN) return fallback;
  } catch {
    return fallback;
  }
  return next;
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/safeRedirect";

/** Every other path needs a session, so a new route is protected unless it is added here. */
const PUBLIC_PATHS = new Set(["/", "/sign-in", "/sign-up"]);
const AUTH_PAGES = new Set(["/sign-in", "/sign-up"]);
const ADVOCATE_PREFIXES = ["/lawyers", "/messages", "/bookmarks"];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function contentSecurityPolicy(nonce: string) {
  // React needs eval in development for error overlays; production does not.
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession && !PUBLIC_PATHS.has(pathname)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_PAGES.has(pathname)) {
    return NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), request.url));
  }

  if (!env.advocatesEnabled && startsWithAny(pathname, ADVOCATE_PREFIXES)) {
    return NextResponse.redirect(new URL("/legal-aid", request.url));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  // Next.js reads the nonce from the request's policy header while rendering.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Everything except build output and the files in public/.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|demo/).*)"],
};

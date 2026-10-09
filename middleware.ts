import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

const protectedPrefixes = [
  "/dashboard",
  "/cases",
  "/lawyers",
  "/messages",
  "/assistant",
  "/resources",
  "/legal-aid",
  "/documents",
  "/bookmarks",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (isProtected && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/sign-in" || pathname === "/sign-up")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/dashboard",
    "/cases/:path*",
    "/cases",
    "/lawyers/:path*",
    "/lawyers",
    "/messages/:path*",
    "/messages",
    "/assistant/:path*",
    "/assistant",
    "/resources/:path*",
    "/resources",
    "/legal-aid/:path*",
    "/legal-aid",
    "/documents/:path*",
    "/documents",
    "/bookmarks/:path*",
    "/bookmarks",
    "/settings/:path*",
    "/settings",
    "/sign-in",
    "/sign-up",
  ],
};

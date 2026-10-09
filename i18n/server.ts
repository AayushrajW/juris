import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import type en from "@/messages/en.json";
import { APP_NAME } from "@/lib/constants";
import { LOCALE_COOKIE, pickLocale, type Locale } from "./config";

/** How every page but the first is named in the browser tab. */
export const TITLE_TEMPLATE = `%s · ${APP_NAME}`;

export type Messages = typeof en;

/** The language for this request: the saved choice, else the phone's setting, else Marathi. */
export async function requestLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  return pickLocale(saved, (await headers()).get("accept-language"));
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  return (await import(`../messages/${locale}.json`)).default;
}

/**
 * Names a route in the browser tab, and for screen readers, which announce the
 * title when a page opens. The app's name follows it. The pattern is repeated
 * here because a route that names itself stops passing its parent's pattern
 * on to the routes inside it.
 */
export async function titled(pick: (messages: Messages) => string): Promise<Metadata> {
  const title = pick(await loadMessages(await requestLocale()));
  return { title: { default: title, template: TITLE_TEMPLATE } };
}

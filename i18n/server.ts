import { cookies, headers } from "next/headers";
import type en from "@/messages/en.json";
import { LOCALE_COOKIE, pickLocale, type Locale } from "./config";

export type Messages = typeof en;

/** The language for this request: the saved choice, else the phone's setting, else Marathi. */
export async function requestLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  return pickLocale(saved, (await headers()).get("accept-language"));
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  return (await import(`../messages/${locale}.json`)).default;
}

import type { Locale } from "@/i18n/config";
import { EN } from "./en";
import { HI } from "./hi";
import { MR } from "./mr";
import type { DemoLocale } from "./types";

const CONTENT: Record<Locale, DemoLocale> = { mr: MR, hi: HI, en: EN };

export function demoLocale(locale: Locale): DemoLocale {
  return CONTENT[locale];
}

/** True for the three sample cases that ship with the demo. */
export function isDemoCase(caseId: string): boolean {
  return caseId in EN.analyses;
}

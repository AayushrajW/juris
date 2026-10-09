import type { MatterCategory } from "@/domain/case";
import { env } from "@/lib/env";

/** The product name. It is never translated. */
export const APP_NAME = "Juris";

export const SESSION_COOKIE = "juris_session";

/** Where "I need a person" leads. Advocate listings stay off until they are compliant. */
export const HELP_HREF = env.advocatesEnabled ? "/lawyers" : "/legal-aid";

/** `label` and `shortLabel` are keys in the "nav" messages. */
export const CITIZEN_NAV = [
  { href: "/dashboard", label: "home", shortLabel: "home" },
  { href: "/cases", label: "problems", shortLabel: "problemsShort" },
  { href: "/assistant", label: "ask", shortLabel: "ask" },
  { href: HELP_HREF, label: "help", shortLabel: "helpShort" },
] as const;

export const MATTER_CATEGORIES: MatterCategory[] = [
  "tenancy",
  "consumer",
  "employment",
  "family",
  "property",
  "criminal_complaint",
  "documents_id",
  "other",
];

/** English only. Used by the advocate screens, which are switched off and not translated. */
export const MATTER_LABELS: Record<string, string> = {
  consumer: "Shop / product",
  tenancy: "Rent / house",
  employment: "Job / salary",
  family: "Family",
  criminal_complaint: "Police",
  property: "Land / house",
  documents_id: "ID papers",
  other: "Other",
};

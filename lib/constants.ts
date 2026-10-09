import { env } from "@/lib/env";

export const APP_NAME = "Juris";
export const APP_TAGLINE = "Law made simple";

export const DISCLAIMER_SHORT =
  "This app explains papers in simple words. It is not a lawyer.";

export const DISCLAIMER_LONG =
  "Juris is a citizen-facing assistant. It helps you read documents, organise facts, and prepare questions. It does not replace an advocate, legal aid counsel, or a court. Demo cases in this prototype are fictional. Legal information shown here is unverified sample content, not research for your situation.";

export const DEMO_AUTH_NOTE =
  "This is a demo. Any name and email will open the app.";

export const SESSION_COOKIE = "juris_session";

/** Where "I need a person" leads. Advocate listings stay off until they are compliant. */
export const HELP_HREF = env.advocatesEnabled ? "/lawyers" : "/legal-aid";

export const CITIZEN_NAV = [
  { href: "/dashboard", label: "Home", shortLabel: "Home" },
  { href: "/cases", label: "My problems", shortLabel: "Problems" },
  { href: "/assistant", label: "Ask", shortLabel: "Ask" },
  { href: HELP_HREF, label: env.advocatesEnabled ? "Find a person" : "Free help", shortLabel: "Help" },
] as const;

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

/**
 * Official phone numbers and websites shown on the Free help screen.
 *
 * These are read by people in real trouble, so every entry must come from an
 * official source. Re-check them every three months and update LAST_CHECKED.
 * `name` and `body` are keys in the "help" messages.
 */
export const HELPLINES_LAST_CHECKED = "2026-10-09";

type HelplineKey = "nalsa" | "mslsa" | "teleLaw" | "consumer" | "emergency" | "women" | "child" | "cyber";

export interface Helpline {
  id: string;
  number: string;
  /** What to dial. Kept separate so the shown number can have spaces. */
  dial: string;
  name: `${HelplineKey}Name`;
  body: `${HelplineKey}Body`;
}

/** Free legal help. Source: nalsa.gov.in and maharashtra.nalsa.gov.in/contact-us. */
export const LEGAL_HELPLINES = [
  { id: "nalsa", number: "15100", dial: "15100", name: "nalsaName", body: "nalsaBody" },
  { id: "mslsa", number: "1800 222 324", dial: "1800222324", name: "mslsaName", body: "mslsaBody" },
  { id: "telelaw", number: "14454", dial: "14454", name: "teleLawName", body: "teleLawBody" },
  { id: "consumer", number: "1915", dial: "1915", name: "consumerName", body: "consumerBody" },
] as const satisfies readonly Helpline[];

/** National emergency numbers. */
export const EMERGENCY_HELPLINES = [
  { id: "emergency", number: "112", dial: "112", name: "emergencyName", body: "emergencyBody" },
  { id: "women", number: "181", dial: "181", name: "womenName", body: "womenBody" },
  { id: "child", number: "1098", dial: "1098", name: "childName", body: "childBody" },
  { id: "cyber", number: "1930", dial: "1930", name: "cyberName", body: "cyberBody" },
] as const satisfies readonly Helpline[];

export const OFFICIAL_SITES = [
  { id: "nalsa", url: "https://nalsa.gov.in/", name: "siteNalsa" },
  { id: "mslsa", url: "https://maharashtra.nalsa.gov.in/", name: "siteMslsa" },
  { id: "ecourts", url: "https://ecourts.gov.in/", name: "siteEcourts" },
  { id: "consumer", url: "https://consumerhelpline.gov.in/", name: "siteConsumer" },
  { id: "indiacode", url: "https://www.indiacode.nic.in/", name: "siteIndiaCode" },
] as const;

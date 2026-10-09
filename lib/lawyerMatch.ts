import type { MatterCategory } from "@/domain/case";
import type { LawyerProfile } from "@/domain/lawyer";

export interface MatchContext {
  category?: MatterCategory;
  city?: string;
  state?: string;
  languages?: string[];
}

export interface LawyerMatch {
  score: number;
  reasons: string[];
}

function samePlace(a?: string, b?: string) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function matchLawyer(lawyer: LawyerProfile, ctx: MatchContext = {}): LawyerMatch {
  const reasons: string[] = [];
  let score = 58;

  if (ctx.category && lawyer.practiceAreas.includes(ctx.category)) {
    score += 18;
    reasons.push("Handles similar cases");
  }

  if (samePlace(lawyer.city, ctx.city)) {
    score += 12;
    reasons.push(`${lawyer.city} jurisdiction`);
  } else if (samePlace(lawyer.state, ctx.state)) {
    score += 8;
    reasons.push(`${lawyer.state} jurisdiction`);
  }

  if ((lawyer.yearsExperience ?? 0) >= 10) {
    score += 8;
    reasons.push(`${lawyer.yearsExperience}+ years experience`);
  } else if (lawyer.yearsExperience) {
    score += 4;
    reasons.push(`${lawyer.yearsExperience} years experience`);
  }

  const preferred = ctx.languages?.length ? ctx.languages : ["Hindi", "English"];
  const overlap = lawyer.languages.filter((lang) =>
    preferred.some((p) => p.toLowerCase() === lang.toLowerCase()),
  );
  if (overlap.length) {
    score += 6;
    reasons.push("Speaks your language");
  }

  if ((lawyer.consultationFeeInr ?? 0) > 0 && (lawyer.consultationFeeInr ?? 0) <= 2500) {
    score += 4;
    reasons.push("Within a typical citizen consultation range");
  }

  if (reasons.length < 5) {
    reasons.push("Listed for citizen consultations in this prototype");
  }

  return { score: Math.min(98, score), reasons: reasons.slice(0, 5) };
}

export function sortLawyersByMatch(lawyers: LawyerProfile[], ctx: MatchContext) {
  return lawyers
    .map((lawyer) => ({ lawyer, match: matchLawyer(lawyer, ctx) }))
    .sort((a, b) => b.match.score - a.match.score);
}

import { describe, expect, it } from "vitest";
import { generateDemoAnalysis, shorten } from "@/data/mocks/generateAnalysis";
import { demoLocale } from "@/data/mocks/locales";
import type { CaseRecord } from "@/domain/case";
import { LOCALES } from "@/i18n/config";

describe("shorten", () => {
  it("leaves short text alone", () => {
    expect(shorten("A short story.", 280)).toBe("A short story.");
  });

  it("cuts at the last whole word and shows that it was cut", () => {
    expect(shorten("one two three four five", 12)).toBe("one two…");
    expect(shorten("one two three four five", 13)).toBe("one two three…");
  });

  it("never ends in the middle of a Devanagari word", () => {
    const story = "घरमालकाने मला पंधरा दिवसांत घर सोडायला सांगितले आहे आणि डिपॉझिट परत देणार नाही असे म्हटले आहे";
    const words = story.split(" ");
    for (let limit = 10; limit < story.length; limit += 7) {
      const cut = shorten(story, limit);
      expect(cut.endsWith("…")).toBe(true);
      // Everything before the ellipsis is a run of whole words from the original.
      const kept = cut.slice(0, -1).split(" ");
      expect(kept).toEqual(words.slice(0, kept.length));
    }
  });
});

describe("generateDemoAnalysis", () => {
  const record: CaseRecord = {
    id: "case-test",
    citizenId: "user-test",
    title: "Test",
    category: "tenancy",
    source: "description",
    status: "ready",
    createdAt: "2026-10-09T00:00:00.000Z",
    updatedAt: "2026-10-09T00:00:00.000Z",
    location: { city: "Pune", state: "Maharashtra" },
    isDemo: true,
  };

  it.each(LOCALES)("builds a complete explanation in %s", (locale) => {
    const analysis = generateDemoAnalysis(record, "Something happened.", demoLocale(locale));
    expect(analysis.caseId).toBe("case-test");
    expect(analysis.plainLanguageSummary).toContain("Something happened.");
    expect(analysis.keyFacts[0]).toContain("Pune");
    // A story-only case has no paper, so nothing is quoted from one.
    expect(analysis.clauses).toEqual([]);
    expect(analysis.nextSteps.length).toBeGreaterThan(0);
    expect(analysis.questionsForLawyer.length).toBeGreaterThan(0);
  });
});

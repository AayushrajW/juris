import { describe, expect, it } from "vitest";
import { demoLocale, isDemoCase } from "@/data/mocks/locales";
import { DEMO_CASES } from "@/data/mocks/cases";
import { isoDayFromToday } from "@/data/mocks/demoDates";
import { LOCALES, pickLocale } from "@/i18n/config";
import { daysLeftParts } from "@/lib/deadlines";
import { createTranslator } from "use-intl";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import mr from "@/messages/mr.json";

type Tree = { [key: string]: string | Tree };

const MESSAGES: Record<string, Tree> = { en, hi, mr };
const DEVANAGARI_DIGIT = /[०-९]/;

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

/**
 * The names a message expects to be filled in, such as {app} or {days, plural, …}.
 * Only outermost braces count: the words inside a plural's branches are text.
 */
function placeholders(message: string): string[] {
  const names: string[] = [];
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    if (message[i] === "{") {
      if (depth === 0) names.push(/^\w+/.exec(message.slice(i + 1))?.[0] ?? "");
      depth++;
    } else if (message[i] === "}") {
      depth--;
    }
  }
  return names.sort();
}

describe("interface text", () => {
  const base = flatten(en);

  it.each(["mr", "hi"])("%s has exactly the same keys as English", (locale) => {
    expect(Object.keys(flatten(MESSAGES[locale])).sort()).toEqual(Object.keys(base).sort());
  });

  it.each(["mr", "hi"])("%s fills in the same values as English", (locale) => {
    const other = flatten(MESSAGES[locale]);
    for (const [key, message] of Object.entries(base)) {
      expect(placeholders(other[key]), key).toEqual(placeholders(message));
    }
  });

  it.each(["mr", "hi"])("%s is written in Devanagari with Western digits", (locale) => {
    for (const [key, message] of Object.entries(flatten(MESSAGES[locale]))) {
      expect(message.trim(), key).not.toBe("");
      expect(DEVANAGARI_DIGIT.test(message), key).toBe(false);
    }
  });
});

describe("days-left wording", () => {
  const today = new Date(2026, 9, 9);

  it.each(LOCALES)("%s shows the count in Western digits", (locale) => {
    const t = createTranslator({ locale, messages: MESSAGES[locale] as typeof en, namespace: "deadline" });
    const say = (date: string) => {
      const parts = daysLeftParts(date, today)!;
      return t(parts.key, parts.values);
    };
    for (const text of [say("2026-10-18"), say("2026-10-01")]) {
      expect(text).toMatch(/[89]/);
      expect(DEVANAGARI_DIGIT.test(text)).toBe(false);
    }
    // Today has its own word, with no number.
    expect(say("2026-10-09")).not.toMatch(/[0-9]/);
  });
});

describe("pickLocale", () => {
  it("uses a saved choice first", () => {
    expect(pickLocale("en", "hi-IN")).toBe("en");
    expect(pickLocale("hi", null)).toBe("hi");
  });

  it("follows a Hindi or Marathi phone, and otherwise starts in Marathi", () => {
    expect(pickLocale(undefined, "hi-IN,en;q=0.8")).toBe("hi");
    expect(pickLocale(undefined, "mr")).toBe("mr");
    // Many phones are set to English first with the owner's own language second.
    expect(pickLocale(undefined, "en-IN,hi;q=0.9,en;q=0.8")).toBe("hi");
    expect(pickLocale(undefined, "en-GB, mr-IN;q=0.7")).toBe("mr");
    expect(pickLocale(undefined, "en-IN,en;q=0.9")).toBe("mr");
    expect(pickLocale(undefined, null)).toBe("mr");
    expect(pickLocale("fr", null)).toBe("mr");
  });
});

describe("sample content", () => {
  const english = demoLocale("en");

  it("covers every sample case in every language", () => {
    for (const locale of LOCALES) {
      const content = demoLocale(locale);
      for (const record of DEMO_CASES) {
        expect(isDemoCase(record.id)).toBe(true);
        expect(content.caseTitles[record.id], `${locale} title ${record.id}`).toBeTruthy();
        expect(content.analyses[record.id]?.caseId, `${locale} analysis ${record.id}`).toBe(record.id);
        if (record.source !== "document") {
          expect(content.descriptions[record.id]?.narrative, `${locale} story ${record.id}`).toBeTruthy();
        }
      }
    }
  });

  it.each(["mr", "hi"] as const)("%s keeps the same structure as English", (locale) => {
    const content = demoLocale(locale);
    for (const [caseId, analysis] of Object.entries(english.analyses)) {
      const other = content.analyses[caseId];
      // Ids, dates, links and categories must match; only the wording may differ.
      const shape = (a: typeof analysis) => ({
        clauses: a.clauses.map((c) => [c.id, c.excerpt]),
        obligations: a.obligations.map((o) => [o.id, o.actor]),
        risks: a.risks.map((r) => [r.id, r.severity]),
        deadlines: a.deadlines.map((d) => [d.id, d.date, d.urgency]),
        missing: a.missingInformation.map((m) => m.id),
        evidence: a.evidenceChecklist.map((e) => [e.id, e.status]),
        legal: a.legalInformation.map((l) => [l.id, l.verification]),
        sources: a.sources.map((s) => [s.id, s.kind, s.url]),
        steps: a.nextSteps.map((s) => [s.id, s.order, s.kind]),
        facts: a.keyFacts.length,
        questions: a.questionsForLawyer.length,
      });
      expect(shape(other), `${locale} ${caseId}`).toEqual(shape(analysis));
    }
  });

  it.each(["mr", "hi"] as const)("%s uses Western digits", (locale) => {
    expect(DEVANAGARI_DIGIT.test(JSON.stringify(demoLocale(locale)))).toBe(false);
  });

  it("answers each suggested question with the matching sample reply", () => {
    // The suggestion buttons only work if their wording contains a word the demo assistant looks for.
    for (const locale of LOCALES) {
      const { keywords } = demoLocale(locale).chat;
      const ui = flatten(MESSAGES[locale]);
      const has = (key: string, words: string[]) =>
        words.some((word) => ui[key].toLowerCase().includes(word));
      expect(has("assistant.suggest1", keywords.date), `${locale} date`).toBe(true);
      expect(has("assistant.suggest2", keywords.next), `${locale} next`).toBe(true);
      expect(has("assistant.suggest3", keywords.person), `${locale} person`).toBe(true);
      // "Who should I ask" must not be mistaken for a question about dates, which is checked second.
      expect(has("assistant.suggest1", keywords.person), `${locale} date is not person`).toBe(false);
    }
  });
});

describe("sample dates", () => {
  it("are counted in calendar days from today", () => {
    const today = new Date(2026, 9, 9, 23, 30);
    expect(isoDayFromToday(0, today)).toBe("2026-10-09");
    expect(isoDayFromToday(9, today)).toBe("2026-10-18");
    expect(isoDayFromToday(25, today)).toBe("2026-11-03");
  });
});

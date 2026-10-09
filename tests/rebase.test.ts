import { describe, expect, it } from "vitest";
import { DEMO_ANALYSES } from "@/data/mocks/analyses";
import { DEMO_REFERENCE_DAY, daysSinceReference, shiftDates } from "@/data/mocks/rebase";
import { nextDeadline } from "@/lib/deadlines";

describe("shiftDates", () => {
  it("moves date-only strings and instants, and leaves other text alone", () => {
    const input = {
      day: "2026-08-27",
      instant: "2026-08-18T08:12:00.000Z",
      text: "August 2026",
      nested: [{ date: "2026-12-31" }],
      count: 3,
      nothing: null,
    };
    expect(shiftDates(input, 2)).toEqual({
      day: "2026-08-29",
      instant: "2026-08-20T08:12:00.000Z",
      text: "August 2026",
      nested: [{ date: "2027-01-02" }],
      count: 3,
      nothing: null,
    });
  });

  it("copies instead of changing the original", () => {
    const input = { items: [{ date: "2026-08-27" }] };
    const output = shiftDates(input, 5);
    expect(input.items[0].date).toBe("2026-08-27");
    expect(output.items).not.toBe(input.items);
  });
});

describe("daysSinceReference", () => {
  it("is zero on the reference day and counts calendar days after it", () => {
    expect(DEMO_REFERENCE_DAY).toBe("2026-08-18");
    expect(daysSinceReference(new Date(2026, 7, 18, 23, 59))).toBe(0);
    expect(daysSinceReference(new Date(2026, 7, 19, 0, 1))).toBe(1);
    expect(daysSinceReference(new Date(2026, 9, 9))).toBe(52);
  });
});

describe("demo data", () => {
  it("always has a date ahead once shifted to today", () => {
    const now = new Date(2030, 0, 15);
    const shifted = shiftDates(DEMO_ANALYSES, daysSinceReference(now));
    const all = Object.values(shifted).flatMap((analysis) => analysis.deadlines);
    expect(nextDeadline(all, now)).not.toBeNull();
  });
});

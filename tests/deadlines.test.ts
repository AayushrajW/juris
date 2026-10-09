import { describe, expect, it } from "vitest";
import { daysLeftText, deadlineState, nextDeadline } from "@/lib/deadlines";
import { daysUntil } from "@/lib/format";

// Late evening, to catch off-by-one errors around midnight.
const today = new Date(2026, 9, 9, 23, 30);

describe("daysUntil", () => {
  it("counts whole calendar days whatever the time of day", () => {
    expect(daysUntil("2026-10-09", today)).toBe(0);
    expect(daysUntil("2026-10-10", today)).toBe(1);
    expect(daysUntil("2026-10-08", today)).toBe(-1);
    expect(daysUntil("2026-11-09", today)).toBe(31);
  });

  it("returns null for a missing or unreadable date", () => {
    expect(daysUntil(undefined, today)).toBeNull();
    expect(daysUntil("not a date", today)).toBeNull();
  });
});

describe("deadlineState", () => {
  it("is worked out from the date", () => {
    expect(deadlineState(undefined, today)).toBe("none");
    expect(deadlineState("2026-08-22", today)).toBe("passed");
    expect(deadlineState("2026-10-08", today)).toBe("passed");
    expect(deadlineState("2026-10-09", today)).toBe("urgent");
    expect(deadlineState("2026-10-12", today)).toBe("urgent");
    expect(deadlineState("2026-10-13", today)).toBe("soon");
    expect(deadlineState("2026-10-23", today)).toBe("soon");
    expect(deadlineState("2026-10-24", today)).toBe("upcoming");
  });
});

describe("daysLeftText", () => {
  it("uses plain words", () => {
    expect(daysLeftText("2026-10-09", today)).toBe("Today");
    expect(daysLeftText("2026-10-10", today)).toBe("Tomorrow");
    expect(daysLeftText("2026-10-18", today)).toBe("9 days left");
    expect(daysLeftText("2026-10-08", today)).toBe("Yesterday");
    expect(daysLeftText("2026-10-01", today)).toBe("8 days ago");
    expect(daysLeftText(undefined, today)).toBeNull();
  });
});

describe("nextDeadline", () => {
  it("picks the nearest date that has not passed", () => {
    const items = [
      { id: "old", date: "2026-08-22" },
      { id: "far", date: "2027-03-03" },
      { id: "near", date: "2026-10-18" },
      { id: "undated" },
    ];
    expect(nextDeadline(items, today)?.id).toBe("near");
  });

  it("returns null when every date has passed", () => {
    expect(nextDeadline([{ date: "2026-08-22" }, { date: "2026-08-27" }], today)).toBeNull();
    expect(nextDeadline([], today)).toBeNull();
  });
});

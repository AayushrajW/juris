import { describe, expect, it } from "vitest";
import { formatDate, formatFileSize, initials } from "@/lib/format";

describe("formatDate", () => {
  it("shows a date-only string as that calendar day", () => {
    expect(formatDate("2026-08-27")).toMatch(/27 Aug 2026/);
  });

  it("has a plain fallback", () => {
    expect(formatDate(undefined)).toBe("Date not known");
    expect(formatDate("nonsense")).toBe("Date not known");
  });
});

describe("initials", () => {
  it("uses first and last name", () => {
    expect(initials("Meera Iyer")).toBe("MI");
    expect(initials("Meera")).toBe("ME");
  });

  it("ignores the Adv. title", () => {
    expect(initials("Adv. Kavita Sharma")).toBe("KS");
  });

  it("never fails on empty input", () => {
    expect(initials(null)).toBe("U");
    expect(initials("   ")).toBe("U");
    expect(initials("Adv.")).toBe("U");
  });
});

describe("formatFileSize", () => {
  it("picks a readable unit", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(94200)).toBe("92 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

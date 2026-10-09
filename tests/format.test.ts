import { describe, expect, it } from "vitest";
import { firstName, formatDate, formatFileSize, initials } from "@/lib/format";

describe("formatDate", () => {
  it("shows a date-only string as that calendar day, with the month in full", () => {
    expect(formatDate("2026-08-27", "en")).toBe("27 August 2026");
    expect(formatDate("2026-01-01", "en")).toBe("1 January 2026");
    expect(formatDate("2026-12-31", "en")).toBe("31 December 2026");
  });

  it("uses the reader's language with Western digits", () => {
    expect(formatDate("2026-08-27", "mr")).toBe("27 ऑगस्ट 2026");
    expect(formatDate("2026-08-27", "hi")).toBe("27 अगस्त 2026");
    expect(formatDate("2026-10-18", "mr")).toBe("18 ऑक्टोबर 2026");
    expect(formatDate("2026-10-18", "hi")).toBe("18 अक्टूबर 2026");
  });

  it("returns null when there is no readable date", () => {
    expect(formatDate(undefined, "en")).toBeNull();
    expect(formatDate("nonsense", "en")).toBeNull();
  });
});

describe("initials", () => {
  it("uses first and last name", () => {
    expect(initials("Meera Iyer")).toBe("MI");
    expect(initials("Meera")).toBe("M");
  });

  it("ignores the Adv. title", () => {
    expect(initials("Adv. Kavita Sharma")).toBe("KS");
  });

  it("keeps a Devanagari letter whole, with its vowel sign", () => {
    expect(initials("मीरा अय्यर")).toBe("मीअ");
  });

  it("never fails on empty input", () => {
    expect(initials(null)).toBe("U");
    expect(initials("   ")).toBe("U");
    expect(initials("Adv.")).toBe("U");
  });
});

describe("firstName", () => {
  it("takes the first word, or nothing", () => {
    expect(firstName("Meera Iyer")).toBe("Meera");
    expect(firstName("  ")).toBe("");
    expect(firstName(null)).toBe("");
  });
});

describe("formatFileSize", () => {
  it("picks a readable unit", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(94200)).toBe("92 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

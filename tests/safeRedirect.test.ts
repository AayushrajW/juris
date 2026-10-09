import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safeRedirect";

describe("safeNextPath", () => {
  it("keeps paths on this site, with their query and hash", () => {
    expect(safeNextPath("/cases")).toBe("/cases");
    expect(safeNextPath("/cases/case-1?tab=plan#dates")).toBe("/cases/case-1?tab=plan#dates");
  });

  it("falls back when nothing is given", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
    expect(safeNextPath(null, "/cases")).toBe("/cases");
  });

  it.each([
    "https://example.com/phish",
    "http://example.com",
    "//example.com",
    "/\\example.com",
    "\\\\example.com",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "example.com",
    "/\t/example.com",
    "/\n/example.com",
    " /cases",
  ])("rejects %j", (value) => {
    expect(safeNextPath(value)).toBe("/dashboard");
  });
});

import { describe, expect, it } from "vitest";
import { cleanCode, showPhone, toIndianMobile, westernDigits } from "@/lib/phone";

describe("mobile numbers", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["98765-43210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["+919876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["(98765) 43210", "+919876543210"],
    ["६१२३४५६७८९", "+916123456789"],
    ["+९१ ९८७६५ ४३२१०", "+919876543210"],
  ])("reads %j as %s", (typed, expected) => {
    expect(toIndianMobile(typed)).toBe(expected);
  });

  it.each([
    "",
    "98765",
    "987654321",
    "98765432101",
    // Indian mobile numbers start with 6, 7, 8 or 9.
    "5876543210",
    "1234567890",
    "+1 202 555 0143",
    "+44 7911 123456",
    "abcdefghij",
    "98765x3210",
    // A second country code in front of an already complete number.
    "+91 +91 9876543210",
  ])("refuses %j", (typed) => {
    expect(toIndianMobile(typed)).toBeNull();
  });

  it("shows a number in two groups of five after the country code", () => {
    expect(showPhone("+919876543210")).toBe("+91 98765 43210");
    expect(showPhone("not a number")).toBe("not a number");
  });
});

describe("one-time codes", () => {
  it("keeps only the digits, whatever script they were typed in", () => {
    expect(cleanCode("123456")).toBe("123456");
    expect(cleanCode(" 123 456 ")).toBe("123456");
    expect(cleanCode("१२३४५६")).toBe("123456");
    expect(cleanCode("12-34-56")).toBe("123456");
    expect(cleanCode("")).toBe("");
  });

  it("turns Devanagari digits into Western ones and leaves other text alone", () => {
    expect(westernDigits("०१२३४५६७८९")).toBe("0123456789");
    expect(westernDigits("घर नं. १२")).toBe("घर नं. 12");
  });
});

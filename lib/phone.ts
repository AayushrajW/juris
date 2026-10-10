/*
 * Mobile numbers and the one-time codes sent to them. People type these on
 * phone keypads in several ways: with or without +91 or a leading 0, with
 * spaces, and sometimes in Devanagari digits. All of it is accepted.
 */

const DEVANAGARI_ZERO = 0x0966;

/** ०-९ as 0-9. Everything else is left as it is. */
export function westernDigits(text: string): string {
  return text.replace(/[०-९]/g, (digit) => String(digit.codePointAt(0)! - DEVANAGARI_ZERO));
}

/**
 * An Indian mobile number in international form (+91 and ten digits), or null
 * if what was typed is not one. Indian mobile numbers start with 6, 7, 8 or 9.
 */
export function toIndianMobile(typed: string): string | null {
  const digits = westernDigits(typed).replace(/[\s\-().]/g, "");
  const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(digits);
  return match ? `+91${match[1]}` : null;
}

/** For showing: +91 98765 43210. Anything that is not such a number is shown as it is. */
export function showPhone(phone: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return match ? `+91 ${match[1]} ${match[2]}` : phone;
}

export const CODE_LENGTH = 6;

/** The digits of a typed code, with spaces dropped and Devanagari digits read as Western ones. */
export function cleanCode(typed: string): string {
  return westernDigits(typed).replace(/\D/g, "");
}

import { fail, ok } from "@/domain/result";
import { newId } from "@/lib/ids";
import { CODE_LENGTH, cleanCode, toIndianMobile } from "@/lib/phone";
import type { AuthService, CodeChallenge } from "@/services/types";
import { currentLocale } from "./locale";
import { beginSession, clearSessionCookie, forgetEverything, sessionUser } from "./session";
import { demoUserFromPhone, loadStore, updateStore, type StoredChallenge } from "./store";

const RESEND_AFTER_SECONDS = 30;
const CODE_LASTS_MS = 10 * 60 * 1000;
/** After this many wrong guesses a code is thrown away. */
const MAX_WRONG_TRIES = 5;

function randomCode(): string {
  const numbers = crypto.getRandomValues(new Uint32Array(CODE_LENGTH));
  return Array.from(numbers, (n) => n % 10).join("");
}

function dropChallenge(challengeId: string) {
  updateStore((s) => {
    const challenges = { ...s.challenges };
    delete challenges[challengeId];
    return { ...s, challenges };
  });
}

const expired = () => fail("invalid", { reason: "code_expired", field: "code" });

export const mockAuthService: AuthService = {
  async requestCode(typed) {
    const phone = toIndianMobile(typed);
    if (!phone) return fail("invalid", { field: "phone" });

    const now = Date.now();
    const earlier = Object.values(loadStore().challenges).find((c) => c.phone === phone);
    const waited = earlier ? (now - Date.parse(earlier.sentAt)) / 1000 : Infinity;
    if (waited < RESEND_AFTER_SECONDS) {
      return fail("rate_limited", { retryAfterSeconds: Math.ceil(RESEND_AFTER_SECONDS - waited) });
    }

    const challengeId = `code-${newId()}`;
    const challenge: StoredChallenge = {
      phone,
      code: randomCode(),
      sentAt: new Date(now).toISOString(),
      expiresAt: new Date(now + CODE_LASTS_MS).toISOString(),
      wrongTries: 0,
    };
    // A new code for a number replaces any earlier one: only the latest works.
    updateStore((s) => ({
      ...s,
      challenges: {
        ...Object.fromEntries(Object.entries(s.challenges).filter(([, c]) => c.phone !== phone)),
        [challengeId]: challenge,
      },
    }));
    const sent: CodeChallenge = {
      challengeId,
      phone,
      resendAfterSeconds: RESEND_AFTER_SECONDS,
      expiresAt: challenge.expiresAt,
      // No message is sent in the demo, so the screen has to be told the code.
      demoCode: challenge.code,
    };
    return ok(sent);
  },
  async verifyCode(challengeId, typed) {
    const challenge = loadStore().challenges[challengeId];
    if (!challenge) return expired();
    if (Date.now() >= Date.parse(challenge.expiresAt)) {
      dropChallenge(challengeId);
      return expired();
    }
    if (cleanCode(typed) !== challenge.code) {
      const wrongTries = challenge.wrongTries + 1;
      if (wrongTries >= MAX_WRONG_TRIES) {
        dropChallenge(challengeId);
        return expired();
      }
      updateStore((s) => ({ ...s, challenges: { ...s.challenges, [challengeId]: { ...challenge, wrongTries } } }));
      return fail("invalid", { reason: "wrong_code", field: "code" });
    }

    // A code works once.
    dropChallenge(challengeId);
    // Someone coming back on the same phone keeps the name and language they chose.
    const known = loadStore().user;
    const user = known?.phone === challenge.phone ? known : demoUserFromPhone(challenge.phone, currentLocale());
    beginSession(user);
    return ok(user);
  },
  async signOut() {
    forgetEverything();
    clearSessionCookie();
    return ok(null);
  },
  async getSession() {
    const user = sessionUser();
    if (user) return ok(user);
    // The two halves of the session disagree (the cookie ran out, or was never
    // real), so there is no session, and what is stored must not reach the next person.
    if (loadStore().user) forgetEverything();
    clearSessionCookie();
    return ok(null);
  },
};

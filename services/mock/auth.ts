import { fail, ok } from "@/domain/result";
import type { AuthCredentials, AuthService } from "@/services/types";
import { currentLocale } from "./locale";
import { beginSession, clearSessionCookie, forgetEverything, sessionUser } from "./session";
import { demoUserFromName, loadStore } from "./store";

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const mockAuthService: AuthService = {
  async signIn(credentials: AuthCredentials) {
    if (!LOOKS_LIKE_EMAIL.test(credentials.email.trim())) {
      return fail("invalid", { field: "email" });
    }
    const user = demoUserFromName(credentials.displayName, credentials.email, currentLocale());
    beginSession(user);
    return ok(user);
  },
  async signUp(credentials: AuthCredentials) {
    return this.signIn(credentials);
  },
  async signOut() {
    forgetEverything();
    clearSessionCookie();
  },
  async getSession() {
    const user = sessionUser();
    if (user) return user;
    // The two halves of the session disagree (the cookie ran out, or was never
    // real), so there is no session, and what is stored must not reach the next person.
    if (loadStore().user) forgetEverything();
    clearSessionCookie();
    return null;
  },
};

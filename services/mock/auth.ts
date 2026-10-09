import { clearBookmarks } from "@/lib/bookmarks";
import { SESSION_COOKIE } from "@/lib/constants";
import { clearNewCaseDraft } from "@/lib/drafts";
import type { AuthCredentials, AuthService } from "@/services/types";
import { clearStore, demoUserFromName, loadStore, updateStore } from "./store";

function writeCookie(userId: string) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax${secure}`;
}

function clearCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

function hasCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((part) => part.startsWith(`${SESSION_COOKIE}=`));
}

/** Phones are shared. Leave nothing behind for the next person. */
function forgetEverything() {
  clearStore();
  clearBookmarks();
  clearNewCaseDraft();
}

export const mockAuthService: AuthService = {
  async signIn(credentials: AuthCredentials) {
    const user = demoUserFromName(credentials.displayName, credentials.email);
    // Anything still stored belongs to whoever used this phone before.
    if (loadStore().user?.email !== user.email) forgetEverything();
    updateStore((s) => ({ ...s, user }));
    writeCookie(user.id);
    return { ok: true, data: user };
  },
  async signUp(credentials: AuthCredentials) {
    return this.signIn(credentials);
  },
  async signOut() {
    forgetEverything();
    clearCookie();
  },
  async getSession() {
    const user = loadStore().user;
    if (user && hasCookie()) return user;
    // The two halves of the session disagree (the cookie ran out, or was never
    // real), so there is no session, and what is stored must not reach the next person.
    if (user) forgetEverything();
    clearCookie();
    return null;
  },
};

import { clearBookmarks } from "@/lib/bookmarks";
import { SESSION_COOKIE } from "@/lib/constants";
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

export const mockAuthService: AuthService = {
  async signIn(credentials: AuthCredentials) {
    const user = demoUserFromName(credentials.displayName, credentials.email);
    updateStore((s) => ({ ...s, user }));
    writeCookie(user.id);
    return { ok: true, data: user };
  },
  async signUp(credentials: AuthCredentials) {
    return this.signIn(credentials);
  },
  async requestPasswordReset(email: string) {
    if (!email.includes("@")) {
      return { ok: false, code: "invalid", message: "Enter a valid email address." };
    }
    return {
      ok: true,
      data: {
        message:
          "This prototype does not send email. In a later release, a reset link would go to this address.",
      },
    };
  },
  async signOut() {
    // Phones are shared. Leave nothing behind for the next person.
    clearStore();
    clearBookmarks();
    clearCookie();
  },
  async getSession() {
    const user = loadStore().user;
    if (user && hasCookie()) return user;
    // The two halves of the session disagree, so there is no session.
    if (user) updateStore((s) => ({ ...s, user: null }));
    clearCookie();
    return null;
  },
};

import { SESSION_COOKIE } from "@/lib/constants";
import type { AuthCredentials, AuthService } from "@/services/types";
import { demoUserFromName, loadStore, saveStore, updateStore } from "./store";

function writeCookie(userId: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax`;
}

function clearCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

export const mockAuthService: AuthService = {
  async signIn(credentials: AuthCredentials) {
    const user = demoUserFromName(
      credentials.displayName || "Meera Iyer",
      credentials.email,
    );
    updateStore((s) => ({ ...s, user }));
    writeCookie(user.id);
    return { ok: true, data: user };
  },
  async signUp(credentials: AuthCredentials) {
    return this.signIn({
      ...credentials,
      displayName: credentials.displayName || credentials.email.split("@")[0],
    });
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
    updateStore((s) => ({ ...s, user: null }));
    clearCookie();
  },
  async getSession() {
    const store = loadStore();
    if (store.user) return store.user;
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    if (!match) return null;
    const user = demoUserFromName("Meera Iyer", "meera.demo@juris.example");
    saveStore({ ...store, user });
    return user;
  },
};

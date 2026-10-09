import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The demo services keep their data in the browser: one stored value and a
 * session cookie. The contract tests run without a browser, so the paths that
 * only exist with one are checked here, against a small stand-in: what a
 * second tab does, a full storage, and a damaged stored value. Phones are
 * shared, so none of these may hand one person's problems to the next.
 */

const STORE_KEY = "juris-mock-v4";
const ASHA = { email: "asha.browser@example.org", displayName: "Asha" };
const BHARAT = { email: "bharat.browser@example.org", displayName: "Bharat" };
const STORY = "My landlord has not returned my deposit for three months.";

class FakeStorage {
  private values = new Map<string, string>();
  /** When set, writes are refused, as they are when storage is full. */
  full = false;

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.full) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

/** Just enough of `document` for cookies and the page language. */
class FakeDocument {
  private jar = new Map<string, string>();
  documentElement = { lang: "en" };

  get cookie() {
    return [...this.jar].map(([name, value]) => `${name}=${value}`).join("; ");
  }
  set cookie(text: string) {
    const [pair, ...attributes] = text.split(";").map((part) => part.trim());
    const name = pair.slice(0, pair.indexOf("="));
    const value = pair.slice(pair.indexOf("=") + 1);
    if (attributes.includes("max-age=0")) this.jar.delete(name);
    else this.jar.set(name, value);
  }
}

type Tab = typeof import("@/services");

/** Opens another tab: the same storage and cookies, but its own copy of everything held in memory. */
async function openTab(): Promise<Tab> {
  vi.resetModules();
  return import("@/services");
}

async function titles(tab: Tab) {
  const listed = await tab.caseService.list({ limit: 50 });
  return listed.ok ? listed.data.items.map((c) => c.title) : listed.error.code;
}

function addCase(tab: Tab, title: string) {
  return tab.caseService.create({ title, category: "tenancy", source: "description", story: { narrative: STORY } });
}

describe("the demo services in a browser", () => {
  let storage: FakeStorage;
  let page: FakeDocument;

  beforeEach(() => {
    storage = new FakeStorage();
    page = new FakeDocument();
    vi.stubGlobal("window", {
      localStorage: storage,
      sessionStorage: new FakeStorage(),
      location: { protocol: "http:" },
    });
    vi.stubGlobal("document", page);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("keeps a person's problems across a reload, in storage", async () => {
    const tab = await openTab();
    await tab.authService.signIn(ASHA);
    await addCase(tab, "Deposit not returned");
    expect(page.cookie).toContain("juris_session=");

    const reloaded = await openTab();
    expect((await reloaded.authService.getSession())?.email).toBe(ASHA.email);
    expect(await titles(reloaded)).toContain("Deposit not returned");
  });

  it("does not bring a person's data back after they sign out in another tab", async () => {
    const first = await openTab();
    await first.authService.signIn(ASHA);
    await addCase(first, "Deposit not returned");
    const second = await openTab();
    expect(await titles(second)).toContain("Deposit not returned");

    await first.authService.signOut();
    expect(storage.getItem(STORE_KEY)).toBeNull();

    // The second tab still has everything in memory. It must not use it, or write it back.
    expect(await titles(second)).toBe("unauthenticated");
    expect((await addCase(second, "Written after sign-out")).ok).toBe(false);
    expect(await second.authService.getSession()).toBeNull();
    expect(storage.getItem(STORE_KEY)).toBeNull();
  });

  it("shows the next person only their own data, even in a tab the first person left open", async () => {
    const left = await openTab();
    await left.authService.signIn(ASHA);
    await addCase(left, "Asha's deposit");

    const other = await openTab();
    await other.authService.signOut();
    await other.authService.signIn(BHARAT);
    await addCase(other, "Bharat's salary");

    const seen = await titles(left);
    expect(seen).toContain("Bharat's salary");
    expect(seen).not.toContain("Asha's deposit");
    expect(JSON.stringify(storage.getItem(STORE_KEY))).not.toContain("Asha");
  });

  it("carries on from memory when storage is full, and loses nothing it was told", async () => {
    const tab = await openTab();
    await tab.authService.signIn(ASHA);
    storage.full = true;

    const made = await addCase(tab, "Made while storage was full");
    expect(made.ok).toBe(true);
    expect(await titles(tab)).toContain("Made while storage was full");
    if (made.ok) expect((await tab.caseService.get(made.data.id)).ok).toBe(true);
  });

  it("lets go of the first person's data when storage was full and someone else has since signed in", async () => {
    const stuck = await openTab();
    await stuck.authService.signIn(ASHA);
    storage.full = true;
    await addCase(stuck, "Asha's deposit");

    // Elsewhere: Asha signs out, which frees the storage, and Bharat signs in.
    storage.full = false;
    const other = await openTab();
    await other.authService.signOut();
    await other.authService.signIn(BHARAT);
    await addCase(other, "Bharat's salary");

    // The tab that got stuck is still holding Asha's data in memory.
    const seen = await titles(stuck);
    expect(seen).not.toContain("Asha's deposit");
    expect(seen).toContain("Bharat's salary");
    await addCase(stuck, "Written from the old tab");
    expect(storage.getItem(STORE_KEY)).not.toContain("Asha");
    expect((await stuck.authService.getSession())?.email).toBe(BHARAT.email);
  });

  it("treats a session cookie with no data behind it as no session, and clears the cookie", async () => {
    page.cookie = "juris_session=user-made-up; path=/";
    const tab = await openTab();
    expect(await titles(tab)).toBe("unauthenticated");
    expect(await tab.authService.getSession()).toBeNull();
    expect(page.cookie).not.toContain("juris_session=");
  });

  it("starts clean, signed out, from a stored value that cannot be read", async () => {
    const tab = await openTab();
    await tab.authService.signIn(ASHA);
    storage.setItem(STORE_KEY, "{ not json");

    const reloaded = await openTab();
    expect(await reloaded.authService.getSession()).toBeNull();
    expect(await titles(reloaded)).toBe("unauthenticated");
  });

  it("removes what earlier builds stored under their own keys", async () => {
    storage.setItem("juris-mock-v1", '{"user":{"email":"old@example.org"}}');
    storage.setItem("juris-mock-v3", '{"user":{"email":"old@example.org"}}');
    const tab = await openTab();
    await tab.authService.getSession();
    expect(storage.getItem("juris-mock-v1")).toBeNull();
    expect(storage.getItem("juris-mock-v3")).toBeNull();
  });
});

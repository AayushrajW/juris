import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onSessionEnded } from "@/lib/sessionEvents";
import { accountService, authService, caseService, chatService } from "@/services";
import { mockCaseService } from "@/services/mock/cases";
import { setFault } from "@/services/mock/faults";
import { clearStore } from "@/services/mock/store";

/*
 * services/index.ts wraps every service so that two things hold whichever
 * implementation is behind it: a call never throws, and a session that has
 * ended is reported. The screens rely on both.
 */
describe("what every service does, whatever is behind it", () => {
  let ended: number;
  let stopListening: () => void;

  beforeEach(() => {
    clearStore();
    setFault(null);
    ended = 0;
    stopListening = onSessionEnded(() => {
      ended += 1;
    });
  });

  afterEach(() => {
    stopListening();
    setFault(null);
    vi.restoreAllMocks();
  });

  it("turns a thrown error into an 'unavailable' failure", async () => {
    await authService.signIn({ email: "asha.guard@example.org" });
    vi.spyOn(mockCaseService, "list").mockRejectedValue(new Error("connection dropped"));
    vi.spyOn(mockCaseService, "get").mockImplementation(() => {
      throw new Error("broken before it could even answer");
    });

    expect(await caseService.list()).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(await caseService.get("case-tenancy")).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(ended).toBe(0);
  });

  it("passes an ordinary answer through untouched", async () => {
    await authService.signIn({ email: "asha.guard@example.org" });
    const listed = await caseService.list();
    expect(listed.ok && listed.data.items.length).toBe(3);
    expect(await caseService.get("case-does-not-exist")).toEqual({ ok: false, error: { code: "not_found" } });
    expect(ended).toBe(0);
  });

  it("reports that the session has ended when a service says nobody is signed in", async () => {
    expect((await caseService.list()).ok).toBe(false);
    expect(ended).toBe(1);
    await chatService.send("case-tenancy", "What should I do next?");
    await accountService.exportData();
    expect(ended).toBe(3);
  });

  it("reports it when a session ends in the middle of use", async () => {
    await authService.signIn({ email: "asha.guard@example.org" });
    expect((await caseService.list()).ok).toBe(true);
    expect(ended).toBe(0);

    setFault("unauthenticated");
    expect(await caseService.list()).toEqual({ ok: false, error: { code: "unauthenticated" } });
    expect(ended).toBe(1);
  });

  it("does not report other failures as the end of the session", async () => {
    await authService.signIn({ email: "asha.guard@example.org" });
    setFault("rate_limited");
    const limited = await caseService.list();
    expect(limited).toEqual({ ok: false, error: { code: "rate_limited", retryAfterSeconds: 30 } });
    setFault("unavailable");
    expect((await caseService.list()).ok).toBe(false);
    expect(ended).toBe(0);
  });
});

function flag(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be "true" or "false", got "${raw}".`);
}

/**
 * Public build-time settings. A malformed value fails the build instead of
 * shipping. Each NEXT_PUBLIC_* name is written out in full so the bundler can
 * inline it.
 */
export const env = {
  /** Shows the demo banner. Stays on until a real backend stores the data. */
  demoMode: flag("NEXT_PUBLIC_DEMO_MODE", process.env.NEXT_PUBLIC_DEMO_MODE, true),
  /**
   * Advocate listings and advocate chat. The current implementation ranks,
   * rates and prices advocates, so it must stay off in any public build.
   */
  advocatesEnabled: flag(
    "NEXT_PUBLIC_FEATURE_ADVOCATES",
    process.env.NEXT_PUBLIC_FEATURE_ADVOCATES,
    false,
  ),
};

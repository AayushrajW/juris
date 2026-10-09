const NEW_CASE_KEY = "juris-new-case-draft";

/**
 * What a person has typed into the new-problem form so far. Kept for this tab
 * only, so a reload, a language change or a slip of the Back button does not
 * make them type their story again. The chosen file cannot be kept.
 */
export interface NewCaseDraft {
  step: number;
  mode: string;
  title: string;
  category: string;
  city: string;
  stateName: string;
  narrative: string;
  outcomeWanted: string;
}

function tabStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // Storage can be blocked outright (private browsing, strict settings).
    return null;
  }
}

export function loadNewCaseDraft(): Partial<NewCaseDraft> {
  try {
    const parsed: unknown = JSON.parse(tabStorage()?.getItem(NEW_CASE_KEY) ?? "null");
    return parsed && typeof parsed === "object" ? (parsed as Partial<NewCaseDraft>) : {};
  } catch {
    return {};
  }
}

export function saveNewCaseDraft(draft: NewCaseDraft) {
  try {
    tabStorage()?.setItem(NEW_CASE_KEY, JSON.stringify(draft));
  } catch {
    // Full or blocked. The form still works; it just will not survive a reload.
  }
}

export function clearNewCaseDraft() {
  try {
    tabStorage()?.removeItem(NEW_CASE_KEY);
  } catch {
    // Nothing to remove.
  }
}

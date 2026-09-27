// The visitor's privacy choice from the consent banner (RA 10173).
// Stored on this device only. Analytics must check hasUsageConsent() before
// recording anything.

export type ConsentChoice = "all" | "essential";

interface StoredConsent {
  choice: ConsentChoice;
  /** ISO timestamp of when the choice was made. */
  at: string;
  /** Bump when the notice's wording or purposes change, to ask again. */
  version: number;
}

const KEY = "visita:consent";
export const CONSENT_VERSION = 1;

export function getConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredConsent;
    return stored.version === CONSENT_VERSION ? stored.choice : null;
  } catch {
    // Storage blocked (private mode, disabled): treat as not yet chosen.
    return null;
  }
}

export function setConsent(choice: ConsentChoice): void {
  const value: StoredConsent = { choice, at: new Date().toISOString(), version: CONSENT_VERSION };
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Can't persist; the banner will ask again next visit.
  }
  window.dispatchEvent(new CustomEvent("visita:consent", { detail: choice }));
}

export const hasUsageConsent = () => getConsent() === "all";

import { atom, type WritableAtom } from "nanostores";
import { hasAuthCookie, planSync } from "./merge";

// Visitor state shared across islands (PRD 5.2: a header count and a heart on
// the map must update together). Everything is kept on this device; for
// signed-in visitors saved cafes also live on their account (PRD 4.2), which
// becomes the source of truth after this device first syncs with it.

function persistentList(key: string, max?: number): WritableAtom<string[]> {
  const read = (): string[] => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
    } catch {
      return [];
    }
  };
  const store = atom<string[]>(typeof window === "undefined" ? [] : read());
  store.listen((value) => {
    try {
      localStorage.setItem(key, JSON.stringify(max ? value.slice(0, max) : value));
    } catch {
      // Storage blocked: works for this visit only.
    }
  });
  if (typeof window !== "undefined") {
    // Keep tabs in sync.
    window.addEventListener("storage", (e) => {
      if (e.key === key) store.set(read());
    });
  }
  return store;
}

/** localStorage key of the saved list, cleared on sign-out. */
export const SAVED_KEY = "visita:saved";
/** Which account this device's list last synced with; cleared on sign-out. */
export const SYNCED_KEY = "visita:saved-synced";

/** Slugs of saved cafes, most recently saved first. */
export const $saved = persistentList(SAVED_KEY);

/** True once this page load has confirmed a signed-in account. */
let accountSync = false;

export function toggleSaved(slug: string): boolean {
  const list = $saved.get();
  const saved = !list.includes(slug);
  $saved.set(saved ? [slug, ...list] : list.filter((s) => s !== slug));
  if (accountSync) {
    void fetch("/api/saved", {
      method: saved ? "POST" : "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
      })
      // Keep the heart honest: undo if the account didn't take it.
      .catch(() => $saved.set(list));
  }
  return saved;
}

/**
 * Sync this device's saves with the signed-in account, once per page load.
 * The first sync for an account merges the device into it; after that the
 * account wins, so removals made on other devices stick.
 */
async function syncSavedWithAccount(): Promise<void> {
  const res = await fetch("/api/saved", { headers: { accept: "application/json" } });
  if (!res.ok) return; // 401: signed out, device only.
  const { slugs: account, account: userId } = (await res.json()) as { slugs: string[]; account: string };
  let syncedFor: string | null = null;
  try {
    syncedFor = localStorage.getItem(SYNCED_KEY);
  } catch {
    // Storage blocked: treat as a first sync.
  }
  const { next, upload } = planSync({ device: $saved.get(), account, syncedFor, userId });
  if (upload.length > 0) {
    const up = await fetch("/api/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slugs: upload }),
    });
    // 404: none of them are listed any more. Anything else: retry next load.
    if (!up.ok && up.status !== 404) return;
  }
  $saved.set(next);
  try {
    localStorage.setItem(SYNCED_KEY, userId);
  } catch {
    // Not persisted: the next load merges again, which is harmless.
  }
  accountSync = true;
}

if (typeof window !== "undefined" && hasAuthCookie(document.cookie)) {
  syncSavedWithAccount().catch(() => {
    // Offline or unavailable: device list only for this visit.
  });
}

/** The last five cafes viewed (PRD 4.1 "Recently viewed"). */
export const $recent = persistentList("visita:recent", 5);

export function recordRecent(slug: string): void {
  $recent.set([slug, ...$recent.get().filter((s) => s !== slug)].slice(0, 5));
}

/** Unscanned cafes this device has asked Visita to scan. */
export const $demanded = persistentList("visita:demanded");

export function markDemanded(slug: string): void {
  if (!$demanded.get().includes(slug)) $demanded.set([slug, ...$demanded.get()]);
}

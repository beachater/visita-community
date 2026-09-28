import { atom, type WritableAtom } from "nanostores";

// Visitor state shared across islands (PRD 5.2: a header count and a heart on
// the map must update together). Kept on this device for now; saved cafes
// move to the visitor's account when sign-in lands, with a one-time merge of
// what's stored here.

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

/** Slugs of saved cafes, most recently saved first. */
export const $saved = persistentList("visita:saved");

export function toggleSaved(slug: string): boolean {
  const list = $saved.get();
  const saved = !list.includes(slug);
  $saved.set(saved ? [slug, ...list] : list.filter((s) => s !== slug));
  return saved;
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

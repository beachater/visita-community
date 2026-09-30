import { hasUsageConsent } from "../consent";

// Usage statistics for venue owners (PRD 4.4), sent only when the visitor
// chose "Allow usage stats" (RA 10173). Events are queued and sent in small
// batches; when the page is being hidden they go by sendBeacon, which
// survives navigation. The session id is random per tab, kept in
// sessionStorage, and never linked to an account.

export type EventType = "profile_view" | "walkthrough_open" | "directions_tap" | "search_appearance" | "filter_click" | "demand_tap";

interface QueuedEvent {
  type: EventType;
  venueId: string;
  props: { filters?: string[] };
}

interface Deps {
  consent: () => boolean;
  sessionId: () => string;
  sendBeacon: (url: string, data: Blob) => boolean;
  fetch: (url: string, init: RequestInit) => Promise<unknown>;
  delayMs?: number;
  maxBatch?: number;
}

export interface Tracker {
  track: (type: EventType, venueId: string, props?: QueuedEvent["props"]) => void;
  /** Send what's queued now; `beacon` when the page is going away. */
  flush: (beacon?: boolean) => void;
}

const ENDPOINT = "/api/track";

export function createTracker({ consent, sessionId, sendBeacon, fetch, delayMs = 4000, maxBatch = 20 }: Deps): Tracker {
  let queue: QueuedEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (beacon = false) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (queue.length === 0) return;
    const events = queue;
    queue = [];
    if (!consent()) return; // Withdrawn meanwhile: drop, don't send.
    const body = JSON.stringify({ consent: "usage", sessionId: sessionId(), events });
    if (beacon && sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {
      // Stats are best-effort; never bother the visitor.
    });
  };

  return {
    track(type, venueId, props = {}) {
      if (!consent()) return;
      queue.push({ type, venueId, props });
      if (queue.length >= maxBatch) flush();
      else if (!timer) timer = setTimeout(() => flush(), delayMs);
    },
    flush,
  };
}

function tabSessionId(): string {
  const KEY = "visita:session";
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const noop: Tracker = { track: () => {}, flush: () => {} };

/** The page's tracker. A no-op during prerendering and SSR. */
export const tracker: Tracker =
  typeof window === "undefined"
    ? noop
    : createTracker({
        consent: hasUsageConsent,
        sessionId: tabSessionId,
        sendBeacon: (url, data) => navigator.sendBeacon?.(url, data) ?? false,
        fetch: (url, init) => window.fetch(url, init),
      });

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") tracker.flush(true);
  });
  window.addEventListener("pagehide", () => tracker.flush(true));
}

export const track = (type: EventType, venueId: string, props?: QueuedEvent["props"]) => tracker.track(type, venueId, props);

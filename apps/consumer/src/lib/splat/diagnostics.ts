// Phone-test diagnostics for the walkthrough (BEA-8). Two jobs:
//
// 1. `?debug=splat` shows a small readout over the viewer (load times,
//    gaussian counts, context losses) with a Copy button, so whoever runs the
//    phone test can paste exact numbers instead of guessing.
// 2. Session memory of crashes. iOS Safari often doesn't fire
//    `webglcontextlost` when it runs out of memory: it kills the tab and
//    reloads the page. A marker set while a full scan is open, and cleared
//    when the viewer closes or the page is left normally, survives that reload,
//    so the next open can start in the lighter preview-only mode.

/** Minimal Storage shape, so tests can pass a Map-backed fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const COUNTS_KEY = "visita:splat-diag";
const LIVE_PREFIX = "visita:splat-live:";

export interface SessionCounts {
  /** `webglcontextlost` events seen in this tab. */
  contextLosses: number;
  /** Full scans that were open when the page died without closing them. */
  uncleanExits: number;
}

const DEBUG_KEY = "visita:splat-debug";

/**
 * `?debug=splat` turns the readout on for the rest of the tab session (the map
 * overlay rewrites the URL, so the flag must outlive it); `?debug=off` turns
 * it off again.
 */
export function splatDebugEnabled(search: string, store: KeyValueStore | null = session()): boolean {
  const values = new URLSearchParams(search).getAll("debug");
  try {
    if (values.includes("splat")) store?.setItem(DEBUG_KEY, "1");
    else if (values.includes("off")) store?.removeItem(DEBUG_KEY);
    return store ? store.getItem(DEBUG_KEY) === "1" : values.includes("splat");
  } catch {
    return values.includes("splat");
  }
}

function session(): KeyValueStore | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    // Storage can throw when blocked (some private modes, embedded frames).
    return null;
  }
}

export function readCounts(store: KeyValueStore | null = session()): SessionCounts {
  try {
    const parsed = JSON.parse(store?.getItem(COUNTS_KEY) ?? "{}") as Partial<SessionCounts>;
    return { contextLosses: Number(parsed.contextLosses) || 0, uncleanExits: Number(parsed.uncleanExits) || 0 };
  } catch {
    return { contextLosses: 0, uncleanExits: 0 };
  }
}

function bump(field: keyof SessionCounts, store: KeyValueStore | null): SessionCounts {
  const counts = readCounts(store);
  counts[field] += 1;
  try {
    store?.setItem(COUNTS_KEY, JSON.stringify(counts));
  } catch {
    // Full or blocked storage: the readout just won't remember.
  }
  return counts;
}

export function recordContextLoss(store: KeyValueStore | null = session()): SessionCounts {
  return bump("contextLosses", store);
}

/** True when the last full open of `src` didn't close cleanly. Read-only. */
export function lastFullOpenCrashed(src: string, store: KeyValueStore | null = session()): boolean {
  try {
    return (store?.getItem(LIVE_PREFIX + src) ?? null) !== null;
  } catch {
    return false;
  }
}

/**
 * Call once as the viewer starts. If the last full open of `src` never closed
 * (a crash or reload), counts it and clears the marker. Returns whether it did.
 */
export function consumeCrashMarker(src: string, store: KeyValueStore | null = session()): boolean {
  if (!lastFullOpenCrashed(src, store)) return false;
  markFullScanClosed(src, store);
  bump("uncleanExits", store);
  return true;
}

/** Call while a full scan is open; cleared by `markFullScanClosed`. */
export function markFullScanOpen(src: string, store: KeyValueStore | null = session()): void {
  try {
    store?.setItem(LIVE_PREFIX + src, "1");
  } catch {
    // Blocked storage: crash recovery just won't kick in.
  }
}

export function markFullScanClosed(src: string, store: KeyValueStore | null = session()): void {
  try {
    store?.removeItem(LIVE_PREFIX + src);
  } catch {
    // Nothing to clean up.
  }
}

// ── Readout ────────────────────────────────────────────────────────────────

export interface DiagnosticsSnapshot {
  src: string;
  previewSrc: string | null;
  mode: "full" | "preview-only";
  /** ms since the viewer started, per phase reached (first time only). */
  phases: Partial<Record<string, number>>;
  bytes: { received: number; total: number | null } | null;
  gaussians: { preview: number | null; full: number | null; drawn: number };
  fps: number;
  contextLostThisView: boolean;
  counts: SessionCounts;
  device: {
    ua: string;
    deviceMemory: number | null;
    cores: number | null;
    devicePixelRatio: number;
    maxPixelRatio: number;
    gpu: string | null;
    splatBudget: number;
    lowEnd: boolean;
  };
  /** Chrome only (`performance.memory`); null elsewhere. */
  jsHeapMB: number | null;
}

const MB = 1024 * 1024;

export function formatSeconds(ms: number | undefined): string {
  return ms === undefined ? "–" : `${(ms / 1000).toFixed(1)} s`;
}

export function formatCount(n: number | null): string {
  if (n === null) return "–";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function fileName(url: string): string {
  return url.replace(/[?#].*$/, "").split("/").slice(-2).join("/");
}

/**
 * Plain-text report: what the phone tester pastes back (Copy button). `brief`
 * is the on-screen version: the load numbers only, without device details.
 */
export function formatReport(s: DiagnosticsSnapshot, { brief = false } = {}): string {
  const bytes = s.bytes
    ? `${(s.bytes.received / MB).toFixed(1)}${s.bytes.total ? ` of ${(s.bytes.total / MB).toFixed(1)}` : ""} MB`
    : "–";
  const d = s.device;
  const lines = [
    `scan: ${fileName(s.src)}${s.previewSrc ? ` (preview ${fileName(s.previewSrc)})` : " (no preview)"}`,
    `mode: ${s.mode}`,
    `first view: ${formatSeconds(s.phases["first-view"])} · full detail: ${formatSeconds(s.phases.complete)}${s.phases.error !== undefined ? ` · error at ${formatSeconds(s.phases.error)}` : ""}`,
    `downloaded: ${bytes}`,
    `gaussians: preview ${formatCount(s.gaussians.preview)} · full ${formatCount(s.gaussians.full)} · drawn ${formatCount(s.gaussians.drawn)}`,
    `fps: ${Math.round(s.fps)}`,
    `context lost: ${s.contextLostThisView ? "yes" : "no"} · this tab: ${s.counts.contextLosses} losses, ${s.counts.uncleanExits} crash reloads`,
    `js heap: ${s.jsHeapMB === null ? "n/a" : `${Math.round(s.jsHeapMB)} MB`}`,
    `device: mem ${d.deviceMemory ?? "?"} GB · ${d.cores ?? "?"} cores · dpr ${d.devicePixelRatio} (capped ${d.maxPixelRatio}) · budget ${formatCount(d.splatBudget)}${d.lowEnd ? " · low-end" : ""}`,
    `gpu: ${d.gpu ?? "?"}`,
    `ua: ${d.ua}`,
  ];
  return (brief ? lines.slice(0, 8) : lines).join("\n");
}

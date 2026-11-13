import { describe, expect, it } from "vitest";
import {
  consumeCrashMarker,
  formatCount,
  formatReport,
  lastFullOpenCrashed,
  markFullScanClosed,
  markFullScanOpen,
  readCounts,
  recordContextLoss,
  splatDebugEnabled,
  type DiagnosticsSnapshot,
  type KeyValueStore,
} from "./diagnostics";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const SRC = "/assets/splats/sonnys/v1.sog";

describe("splatDebugEnabled", () => {
  it("turns on with ?debug=splat and stays on for the tab", () => {
    const store = memoryStore();
    expect(splatDebugEnabled("", store)).toBe(false);
    expect(splatDebugEnabled("?debug=splat", store)).toBe(true);
    expect(splatDebugEnabled("", store)).toBe(true);
    expect(splatDebugEnabled("?debug=off", store)).toBe(false);
    expect(splatDebugEnabled("", store)).toBe(false);
  });

  it("ignores other debug values", () => {
    expect(splatDebugEnabled("?debug=1", memoryStore())).toBe(false);
  });

  it("works without storage", () => {
    expect(splatDebugEnabled("?debug=splat", null)).toBe(true);
    expect(splatDebugEnabled("", null)).toBe(false);
  });
});

describe("crash markers", () => {
  it("a clean close leaves nothing behind", () => {
    const store = memoryStore();
    expect(consumeCrashMarker(SRC, store)).toBe(false);
    markFullScanOpen(SRC, store);
    markFullScanClosed(SRC, store);
    expect(lastFullOpenCrashed(SRC, store)).toBe(false);
    expect(consumeCrashMarker(SRC, store)).toBe(false);
    expect(readCounts(store).uncleanExits).toBe(0);
  });

  it("an open that never closed is a crash, counted once", () => {
    const store = memoryStore();
    markFullScanOpen(SRC, store);
    // ...the tab dies and the page reloads.
    expect(lastFullOpenCrashed(SRC, store)).toBe(true);
    expect(consumeCrashMarker(SRC, store)).toBe(true);
    expect(consumeCrashMarker(SRC, store)).toBe(false);
    expect(readCounts(store).uncleanExits).toBe(1);
  });

  it("is per scan", () => {
    const store = memoryStore();
    markFullScanOpen(SRC, store);
    expect(lastFullOpenCrashed("/assets/splats/litos/v1.sog", store)).toBe(false);
  });

  it("counts context losses", () => {
    const store = memoryStore();
    recordContextLoss(store);
    expect(recordContextLoss(store).contextLosses).toBe(2);
    expect(readCounts(store)).toEqual({ contextLosses: 2, uncleanExits: 0 });
  });

  it("survives junk and blocked storage", () => {
    const store = memoryStore();
    store.setItem("visita:splat-diag", "not json");
    expect(readCounts(store)).toEqual({ contextLosses: 0, uncleanExits: 0 });
    const blocked: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => markFullScanOpen(SRC, blocked)).not.toThrow();
    expect(consumeCrashMarker(SRC, blocked)).toBe(false);
    expect(recordContextLoss(blocked)).toEqual({ contextLosses: 1, uncleanExits: 0 });
  });
});

describe("formatReport", () => {
  const snapshot: DiagnosticsSnapshot = {
    src: "https://visita.ph/assets/splats/sonnys/v1.sog",
    previewSrc: "https://visita.ph/assets/splats/sonnys/v1-preview.sog",
    mode: "full",
    phases: { engine: 0, "first-view": 2_340, complete: 14_210 },
    bytes: { received: 51_119_498, total: 51_119_498 },
    gaussians: { preview: 299_999, full: 2_999_992, drawn: 1_204_311 },
    fps: 58.6,
    contextLostThisView: false,
    counts: { contextLosses: 1, uncleanExits: 0 },
    device: {
      ua: "Mozilla/5.0 (iPhone)",
      deviceMemory: null,
      cores: 6,
      devicePixelRatio: 3,
      maxPixelRatio: 1,
      gpu: "Apple GPU",
      splatBudget: 1_000_000,
      lowEnd: false,
    },
    jsHeapMB: null,
  };

  it("reports what the phone tester pastes back", () => {
    const text = formatReport(snapshot);
    expect(text).toContain("scan: sonnys/v1.sog (preview sonnys/v1-preview.sog)");
    expect(text).toContain("first view: 2.3 s · full detail: 14.2 s");
    expect(text).toContain("downloaded: 48.8 of 48.8 MB");
    expect(text).toContain("gaussians: preview 300k · full 3.00M · drawn 1.20M");
    expect(text).toContain("context lost: no · this tab: 1 losses, 0 crash reloads");
    expect(text).toContain("js heap: n/a");
  });

  it("keeps device details out of the on-screen version", () => {
    const brief = formatReport(snapshot, { brief: true });
    expect(brief).toContain("js heap: n/a");
    expect(brief).not.toContain("ua:");
    expect(brief).not.toContain("gpu:");
    expect(formatReport(snapshot)).toContain("ua: Mozilla/5.0 (iPhone)");
  });

  it("marks missing values and errors", () => {
    const text = formatReport({
      ...snapshot,
      previewSrc: null,
      phases: { engine: 0, error: 9_000 },
      bytes: null,
      gaussians: { preview: null, full: null, drawn: 0 },
      contextLostThisView: true,
    });
    expect(text).toContain("(no preview)");
    expect(text).toContain("first view: – · full detail: – · error at 9.0 s");
    expect(text).toContain("downloaded: –");
    expect(text).toContain("context lost: yes");
  });

  it("formats counts", () => {
    expect(formatCount(950)).toBe("950");
    expect(formatCount(956_296)).toBe("956k");
    expect(formatCount(1_500_000)).toBe("1.50M");
    expect(formatCount(null)).toBe("–");
  });
});

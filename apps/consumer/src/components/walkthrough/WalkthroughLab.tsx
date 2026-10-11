import { useEffect, useMemo, useRef, useState } from "react";
import { getDeviceProfile, type DeviceProfile } from "../../lib/splat/device";
import { splatSrc } from "../../lib/splat/source";
import { SplatViewer, type ViewerPhase, type ViewerStats } from "./SplatViewer";

// "preview" = small preview .sog first, then the full .sog swapped in.
type LabFormat = "preview" | "sog" | "streamed";

// Test bench for choosing between bundled .sog and Streamed SOG on real
// phones. Every run is a fresh page load, so earlier runs don't warm memory,
// and /lab/assets responses are no-store, so nothing comes from cache.

const BUDGETS = [250_000, 500_000, 1_000_000, 2_000_000, 3_000_000];

interface Params {
  cafe: string;
  format: LabFormat;
  budget: number | null;
  via: "worker" | "r2";
  /** Debug override: R2 key of the full scan (e.g. splats/sonnys/test-750k.sog). */
  full: string | null;
}

function readParams(): Params {
  const q = new URLSearchParams(location.search);
  const budget = Number(q.get("budget"));
  const full = q.get("full");
  return {
    cafe: q.get("cafe") ?? "sonnys",
    format: q.get("format") === "streamed" ? "streamed" : q.get("format") === "sog" ? "sog" : "preview",
    budget: Number.isFinite(budget) && budget > 0 ? budget : null,
    via: q.get("via") === "r2" ? "r2" : "worker",
    full: full?.startsWith("splats/") ? full : null,
  };
}

function hrefFor(params: Params, change: Partial<Params>) {
  const next = { ...params, ...change };
  const q = new URLSearchParams({ cafe: next.cafe, format: next.format, via: next.via });
  if (next.budget) q.set("budget", String(next.budget));
  if (next.full) q.set("full", next.full);
  return `?${q}`;
}

export function WalkthroughLab() {
  const params = useMemo(readParams, []);
  const profile = useMemo<DeviceProfile>(getDeviceProfile, []);
  const [confirmed, setConfirmed] = useState(!profile.lowEnd);
  const [phases, setPhases] = useState<Partial<Record<ViewerPhase, number>>>({});
  const [stats, setStats] = useState<ViewerStats>({ fps: 0, splats: 0 });
  const [peakSplats, setPeakSplats] = useState(0);
  const [bytes, setBytes] = useState({ total: 0, requests: 0 });
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // An uncaught error halts the engine's frame loop, which looks like a
  // freeze. Record errors so "Copy results" carries the cause.
  useEffect(() => {
    const add = (message: string) => setErrors((e) => (e.length >= 5 ? e : [...e, message.slice(0, 300)]));
    const onError = (event: ErrorEvent) => add(import.meta.env.DEV
      ? `${event.message} @ ${event.filename?.split("/").pop()}:${event.lineno}`
      : "The viewer stopped unexpectedly.");
    const onRejection = (event: PromiseRejectionEvent) => add(import.meta.env.DEV
      ? `unhandled: ${String(event.reason?.stack ?? event.reason)}`
      : "The viewer stopped unexpectedly.");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const resolve = (key: string) => (params.via === "r2" ? splatSrc(key) : `/lab/assets/${key}`);
  const src = resolve(
    params.full ?? (params.format === "streamed" ? `splats/${params.cafe}/v1/lod-meta.json` : `splats/${params.cafe}/v1.sog`),
  );
  const previewSrc = params.format === "preview" ? resolve(`splats/${params.cafe}/v1-preview.sog`) : undefined;
  const budget = params.budget ?? profile.splatBudget;

  // Count scan bytes from Resource Timing. Only same-origin (via=worker)
  // responses expose sizes; r2.dev responses report 0.
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      let added = 0;
      let requests = 0;
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        if (!entry.name.includes("/splats/") || seen.current.has(entry.name)) continue;
        seen.current.add(entry.name);
        added += entry.encodedBodySize || entry.transferSize || 0;
        requests += 1;
      }
      if (requests) setBytes((b) => ({ total: b.total + added, requests: b.requests + requests }));
    });
    observer.observe({ type: "resource", buffered: true });
    return () => observer.disconnect();
  }, []);

  const summary = [
    `Visita walkthrough lab`,
    `cafe=${params.cafe} format=${params.format} via=${params.via} budget=${params.format === "streamed" ? budget.toLocaleString() : "n/a (fixed file)"}`,
    `first view: ${fmtMs(phases["first-view"])}  complete: ${fmtMs(phases.complete)}  error: ${phases.error !== undefined ? "yes" : "no"}`,
    `downloaded: ${params.via === "worker" ? `${(bytes.total / 1048576).toFixed(1)} MB in ${bytes.requests} requests` : "unknown (via=r2)"}`,
    `splats drawn: ${stats.splats.toLocaleString()} (peak ${peakSplats.toLocaleString()})  fps: ${stats.fps}`,
    `device: ${profile.isIOS ? "iOS" : profile.isMobile ? "Android/mobile" : "desktop"} · memory ${profile.deviceMemory ?? "?"} GB · cores ${profile.cores ?? "?"} · dpr ${window.devicePixelRatio} (capped ${profile.maxPixelRatio}) · ${profile.gpu ?? "GPU hidden"}`,
    `errors: ${errors.length ? errors.join(" || ") : "none"}`,
    `ua: ${navigator.userAgent}`,
  ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy the results:", summary);
    }
  };

  if (!profile.webgl2) {
    return <Notice title="3D isn't available here">This browser doesn't support WebGL 2, which the walkthrough needs.</Notice>;
  }

  if (!confirmed) {
    return (
      <Notice title="This device may struggle">
        It reports {profile.deviceMemory ?? "?"} GB of memory and {profile.cores ?? "?"} cores.
        <button type="button" style={chip(true)} onClick={() => setConfirmed(true)}>
          Load anyway
        </button>
      </Notice>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <SplatViewer
        src={src}
        previewSrc={previewSrc}
        profile={profile}
        splatBudget={budget}
        onPhase={(phase, ms) => setPhases((p) => (p[phase] === undefined ? { ...p, [phase]: ms } : p))}
        onStats={(s) => {
          setStats(s);
          setPeakSplats((p) => Math.max(p, s.splats));
        }}
      />

      <div style={panel}>
        <button type="button" onClick={() => setOpen((o) => !o)} style={{ ...chip(false), width: "100%" }}>
          {open ? "Hide" : "Show"} test panel
        </button>
        {open && (
          <>
            <Row label="Format">
              <a href={hrefFor(params, { format: "preview" })} style={chip(params.format === "preview")}>Preview + full</a>
              <a href={hrefFor(params, { format: "sog" })} style={chip(params.format === "sog")}>Single .sog</a>
              <a href={hrefFor(params, { format: "streamed" })} style={chip(params.format === "streamed")}>Streamed</a>
            </Row>
            {params.format === "streamed" && (
              <Row label="Budget">
                {BUDGETS.map((b) => (
                  <a key={b} href={hrefFor(params, { budget: b })} style={chip(b === budget)}>
                    {b >= 1_000_000 ? `${b / 1_000_000}M` : `${b / 1000}K`}
                  </a>
                ))}
              </Row>
            )}
            <dl style={{ margin: "0.5rem 0", display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.2rem 0.75rem" }}>
              <Stat label={params.format === "preview" ? "Preview shown" : "First view"} value={fmtMs(phases["first-view"])} />
              <Stat label={params.format === "preview" ? "Full detail" : "Fully loaded"} value={fmtMs(phases.complete)} />
              <Stat
                label="Downloaded"
                value={params.via === "worker" ? `${(bytes.total / 1048576).toFixed(1)} MB · ${bytes.requests} req` : "n/a"}
              />
              <Stat label="Splats drawn" value={`${stats.splats.toLocaleString()} (peak ${peakSplats.toLocaleString()})`} />
              <Stat label="FPS" value={stats.fps ? String(stats.fps) : "idle"} />
              <Stat label="Device" value={`${profile.deviceMemory ?? "?"} GB · ${profile.cores ?? "?"} cores`} />
              <Stat label="Errors" value={errors[0] ?? "none"} />
            </dl>
            <button type="button" onClick={copy} style={{ ...chip(true), width: "100%" }}>
              {copied ? "Copied" : "Copy results"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function fmtMs(ms: number | undefined) {
  return ms === undefined ? "…" : `${(ms / 1000).toFixed(1)} s`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem", marginTop: "0.5rem" }}>
      <span style={{ width: "4.5rem", color: "var(--mist)" }}>{label}</span>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ color: "var(--mist)" }}>{label}</dt>
      <dd style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>{value}</dd>
    </>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: "28rem", margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)" }}>{title}</h1>
      <p style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "flex-start" }}>{children}</p>
    </main>
  );
}

const panel = {
  position: "absolute" as const,
  top: "max(0.75rem, env(safe-area-inset-top))",
  right: "0.75rem",
  width: "min(19rem, calc(100vw - 1.5rem))",
  padding: "0.6rem",
  borderRadius: "12px",
  background: "rgba(4, 44, 83, 0.82)",
  backdropFilter: "blur(8px)",
  color: "var(--cloud)",
  fontSize: "0.8rem",
};

function chip(active: boolean) {
  return {
    font: "inherit",
    padding: "0.3rem 0.6rem",
    borderRadius: "999px",
    border: "1px solid var(--mist)",
    background: active ? "var(--cloud)" : "transparent",
    color: active ? "var(--navy)" : "var(--cloud)",
    textDecoration: "none",
    cursor: "pointer",
  };
}

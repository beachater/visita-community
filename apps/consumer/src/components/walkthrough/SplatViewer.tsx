import { useEffect, useRef, useState } from "react";
import type * as PC from "playcanvas";
import type { CameraControls } from "playcanvas/scripts/esm/camera-controls.mjs";
import type { DeviceProfile } from "../../lib/splat/device";
import { splatFormat } from "../../lib/splat/source";
import { createWalkController } from "../../lib/splat/walk-controller";
import { SplatLoader, type LoadProgress } from "./SplatLoader";

export type ViewerPhase = "engine" | "downloading" | "preparing" | "first-view" | "complete" | "error";

export interface ViewerStats {
  fps: number;
  splats: number;
}

export interface SplatViewerProps {
  /** Loadable URL of a bundled `.sog` or a streamed `lod-meta.json`. */
  src: string;
  /**
   * Optional small, decimated `.sog` of the same scan. Shown first so the
   * room appears in seconds, then swapped for `src` once that's on screen.
   */
  previewSrc?: string;
  profile: DeviceProfile;
  /** Overrides the profile's streamed-SOG splat budget. */
  splatBudget?: number;
  /** Fired as loading advances; `ms` is time since the viewer started. */
  onPhase?: (phase: ViewerPhase, ms: number) => void;
  /** Sampled twice a second while mounted. */
  onStats?: (stats: ViewerStats) => void;
}

// Brand navy (#042C53) behind the scan.
const CLEAR_COLOR: [number, number, number] = [0.016, 0.173, 0.325];

/** Background download of full detail while the preview is on screen. */
type DetailState = { received: number; total: number | null } | { failed: true } | null;

/**
 * The walkthrough: a PlayCanvas Gaussian splat viewer. The engine is
 * dynamically imported, so it only downloads when a walkthrough mounts.
 *
 * Bundled .sog (the default): an optional preview file shows first, then the
 * full scan replaces it in place. Streamed SOG (kept for lab comparison) uses
 * the engine's "fast first frame" pattern. Once the scene settles it renders
 * on demand, so an idle view leaves the GPU (and the phone's battery) alone.
 */
export function SplatViewer({ src, previewSrc, profile, splatBudget, onPhase, onStats }: SplatViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState<LoadProgress>({ stage: "engine" });
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>(null);
  const [joystick, setJoystick] = useState<[number, number, number, number] | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Callbacks change identity every render; read them through a ref so they
  // don't restart the engine.
  const callbacks = useRef({ onPhase, onStats });
  callbacks.current = { onPhase, onStats };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const started = performance.now();
    const phase = (p: ViewerPhase) => callbacks.current.onPhase?.(p, performance.now() - started);

    let disposed = false;
    let app: PC.Application | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let statsTimer = 0;

    const fail = (message: string) => {
      if (disposed) return;
      setError(message);
      phase("error");
    };

    // iOS Safari drops WebGL contexts under memory pressure (PRD 5.6 step 8).
    const onContextLost = (event: Event) => {
      event.preventDefault();
      fail("The 3D view stopped, usually because the device ran low on memory.");
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    setError(null);
    setDetail(null);
    setProgress({ stage: "engine" });
    phase("engine");

    (async () => {
      const [pc, { CameraControls: Controls }] = await Promise.all([
        import("playcanvas"),
        import("playcanvas/scripts/esm/camera-controls.mjs"),
      ]);
      if (disposed) return;

      const instance = new pc.Application(canvas, {
        // Splats are fill-rate bound: no MSAA, no alpha, capped pixel ratio.
        graphicsDeviceOptions: { antialias: false, alpha: false, powerPreference: "high-performance" },
      });
      app = instance;
      // Lab pages expose the engine for debugging from the console.
      if (location.pathname.startsWith("/lab")) (window as unknown as { visitaApp?: unknown }).visitaApp = instance;
      instance.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, profile.maxPixelRatio);
      instance.setCanvasFillMode(pc.FILLMODE_NONE);
      instance.setCanvasResolution(pc.RESOLUTION_AUTO);
      instance.scene.gsplat.splatBudget = splatBudget ?? profile.splatBudget;
      // Distance mode keeps less data resident than error mode (2.22's default).
      instance.scene.gsplat.lodMode = pc.GSPLAT_LODMODE_DISTANCE;
      instance.start();

      const gsplatSystem = instance.systems.gsplat;
      if (!gsplatSystem) throw new Error("gsplat system missing from this engine build");

      resizeObserver = new ResizeObserver(() => {
        instance.resizeCanvas(canvas.clientWidth, canvas.clientHeight);
        instance.renderNextFrame = true;
      });
      resizeObserver.observe(canvas);

      const camera = new pc.Entity("camera");
      camera.addComponent("camera", {
        clearColor: new pc.Color(...CLEAR_COLOR),
        fov: 60,
        nearClip: 0.05,
        farClip: 200,
      });
      camera.setPosition(0, 0.8, 2.4);
      instance.root.addChild(camera);
      camera.addComponent("script");
      const controls = camera.script!.create(Controls) as unknown as CameraControls;
      // Walk the room at eye height: virtual joystick on the left half of the
      // screen, drag to look on the right half. The walk controller replaces
      // the fly controller before fly mode attaches it.
      (controls as unknown as { _flyController: PC.FlyController })._flyController = createWalkController(pc);
      controls.enableOrbit = false;
      controls.enableFly = true;
      controls.enablePan = false;
      controls.moveSpeed = 2;
      controls.moveFastSpeed = 5;
      controls.moveSlowSpeed = 1;
      controls.mobileInputLayout = "joystick-touch";
      instance.on("joystick:left", (bx: number, by: number, sx: number, sy: number) => {
        setJoystick(bx < 0 ? null : [bx, by, sx, sy]);
      });

      // On-demand rendering: redraw when the camera moves or streaming has
      // something new to show.
      const lastPos = new pc.Vec3();
      const lastRot = new pc.Quat();
      instance.on("update", () => {
        const pos = camera.getPosition();
        const rot = camera.getRotation();
        if (!pos.equals(lastPos) || !rot.equals(lastRot)) {
          instance.renderNextFrame = true;
          lastPos.copy(pos);
          lastRot.copy(rot);
        }
      });
      gsplatSystem.on("frame:request", () => {
        instance.renderNextFrame = true;
      });

      // ── Loading helpers ─────────────────────────────────────────────────
      const loadAsset = (url: string, onBytes?: (received: number, total: number | null) => void) =>
        new Promise<PC.Asset>((resolve, reject) => {
          const asset = new pc.Asset(url, "gsplat", { url });
          if (onBytes) asset.on("progress", (r: number, t: number) => onBytes(r, t > 0 ? t : null));
          asset.once("load", () => resolve(asset));
          asset.once("error", (err: unknown) => reject(err));
          instance.assets.add(asset);
          instance.assets.load(asset);
        });

      const addScan = (asset: PC.Asset) => {
        const scan = new pc.Entity("scan");
        scan.addComponent("gsplat", { asset });
        // Scans are exported Y-down.
        scan.setLocalEulerAngles(180, 0, 0);
        instance.root.addChild(scan);
        return scan;
      };

      const splatCount = (asset: PC.Asset) => (asset.resource as { numSplats?: number } | null)?.numSplats ?? 0;

      // Resolves once a rendered frame is fully loaded and sorted AND its
      // drawn splat count satisfies `accept`. "Ready" alone isn't proof: right
      // after a scan is added or removed, the next frame can still report
      // ready for the previous scene, before the change has registered.
      // Resolves false if that never happens within `timeoutMs`.
      const drawn = (accept: (splats: number) => boolean = () => true, timeoutMs = 30_000) =>
        new Promise<boolean>((resolve) => {
          const timer = window.setTimeout(() => finish(false), timeoutMs);
          const onReady = (_camera: unknown, _layer: unknown, ready: boolean, loadingCount: number) => {
            if (ready && loadingCount === 0 && accept(instance.stats.frame.gsplats)) finish(true);
            else instance.renderNextFrame = true;
          };
          const finish = (ok: boolean) => {
            window.clearTimeout(timer);
            gsplatSystem.off("frame:ready", onReady);
            resolve(ok);
          };
          gsplatSystem.on("frame:ready", onReady);
          instance.renderNextFrame = true;
        });

      const settle = () => {
        phase("complete");
        instance.autoRender = false;
        instance.renderNextFrame = true;
      };

      // ── Bundled .sog, optionally preview first ─────────────────────────
      // With a preview, a small decimated copy of the same scan shows the
      // room within seconds while the full file downloads. The camera is a
      // separate entity, so swapping scans never moves the visitor, and both
      // files share one coordinate space, so the room doesn't shift.
      const loadBundled = async () => {
        let preview: PC.Entity | null = null;
        let previewAsset: PC.Asset | null = null;

        if (previewSrc) {
          phase("downloading");
          try {
            previewAsset = await loadAsset(previewSrc, (received, total) =>
              setProgress({ stage: "downloading", received, total, label: "Loading a preview of the room" }),
            );
          } catch {
            // No usable preview: load the full scan on its own instead.
            previewAsset = null;
          }
          if (disposed) return;
        }

        if (previewAsset) {
          phase("preparing");
          setProgress({ stage: "preparing", fraction: null });
          preview = addScan(previewAsset);
          await drawn((n) => n > 0);
          if (disposed) return;
          setProgress({ stage: "done" });
          phase("first-view");
          setDetail({ received: 0, total: null });
        } else {
          phase("downloading");
        }

        let fullAsset: PC.Asset;
        try {
          fullAsset = await loadAsset(src, (received, total) =>
            preview
              ? setDetail({ received, total })
              : setProgress({ stage: "downloading", received, total }),
          );
        } catch {
          // Keep the preview on screen; it's still the real room.
          if (preview) setDetail({ failed: true });
          else fail("The scan didn't load. Check your connection and try again.");
          return;
        }
        if (disposed) return;

        if (!preview) {
          phase("preparing");
          setProgress({ stage: "preparing", fraction: null });
        }
        // Counts come from rendered frames, which may skip splats outside the
        // view, so compare against the preview rather than exact totals.
        const previewSplats = previewAsset ? splatCount(previewAsset) : 0;
        const full = addScan(fullAsset);

        if (preview && previewAsset) {
          // 1. Wait until frames draw more than the preview alone, i.e. the
          //    full scan is on screen, so removing the preview leaves no gap.
          const shown = await drawn((n) => n > previewSplats);
          if (disposed) return;
          if (!shown) {
            // Full detail never made it on screen. Keep the preview (it's
            // still the real room) and let the visitor retry.
            full.destroy();
            setDetail({ failed: true });
            return;
          }
          // 2. Remove the preview and let a frame render without it. (The
          //    engine reference-counts splat data, so this is belt and braces.)
          preview.destroy();
          await drawn();
          if (disposed) return;
          // 3. Only now free its memory.
          previewAsset.unload();
          instance.assets.remove(previewAsset);
          setDetail(null);
        } else {
          await drawn((n) => n > 0);
          if (disposed) return;
          setProgress({ stage: "done" });
          phase("first-view");
        }
        settle();
      };

      // ── Streamed SOG (lab comparison) ───────────────────────────────────
      const loadStreamed = async () => {
        phase("downloading");
        const asset = await loadAsset(src);
        if (disposed) return;
        phase("preparing");
        setProgress({ stage: "preparing", fraction: null });

        const gsplat = addScan(asset).gsplat!;
        const lodLevels: number =
          (gsplat.resource as { octree?: { lodLevels?: number } } | null)?.octree?.lodLevels ?? 0;
        if (lodLevels > 0) {
          gsplat.lodRangeMin = lodLevels - 1;
          gsplat.lodRangeMax = lodLevels - 1;
        }

        let firstView = false;
        let maxLoading = 0;
        // Frames since the LOD range opened. Opening it doesn't queue loads
        // until the engine next evaluates LOD, so "nothing loading" right
        // after isn't "finished"; allow a grace period before trusting it.
        let framesSinceOpen = 0;
        const onFrameReady = (_camera: unknown, _layer: unknown, ready: boolean, loadingCount: number) => {
          maxLoading = Math.max(maxLoading, loadingCount);
          if (!firstView && maxLoading > 0) {
            setProgress({ stage: "preparing", fraction: (maxLoading - loadingCount) / maxLoading });
          }
          if (firstView) framesSinceOpen += 1;
          if (!ready || loadingCount > 0) return;
          if (firstView && lodLevels > 0 && maxLoading === 0 && framesSinceOpen < 30) return;

          if (!firstView) {
            firstView = true;
            setProgress({ stage: "done" });
            phase("first-view");
            if (lodLevels > 0) {
              // Coarse view is up; let detail stream in within the budget.
              gsplat.lodRangeMin = 0;
              gsplat.lodRangeMax = lodLevels - 1;
              maxLoading = 0;
              return;
            }
          }
          gsplatSystem.off("frame:ready", onFrameReady);
          settle();
        };
        gsplatSystem.on("frame:ready", onFrameReady);
      };

      setProgress({ stage: "downloading", received: 0, total: null });
      const load = splatFormat(src) === "streamed" ? loadStreamed : loadBundled;
      load().catch(() => fail("The scan didn't load. Check your connection and try again."));

      statsTimer = window.setInterval(() => {
        callbacks.current.onStats?.({ fps: instance.stats.frame.fps, splats: instance.stats.frame.gsplats });
      }, 500);
    })().catch(() => fail("The 3D viewer couldn't start. Try again, or open this cafe on another device."));

    return () => {
      disposed = true;
      window.clearInterval(statsTimer);
      resizeObserver?.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      app?.destroy();
      app = null;
    };
  }, [src, previewSrc, profile, splatBudget, attempt]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--navy)" }}>
      <canvas
        ref={canvasRef}
        aria-label="3D walkthrough. Use the left side of the screen to move and the right side to look around."
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
      />
      {joystick && <Joystick base={[joystick[0], joystick[1]]} stick={[joystick[2], joystick[3]]} />}
      {!error && progress.stage !== "done" && <SplatLoader progress={progress} />}
      {!error && detail && <DetailPill detail={detail} onRetry={() => setAttempt((n) => n + 1)} />}
      {error && (
        <div role="alert" style={overlayStyle}>
          <p style={{ margin: "0 0 1rem", maxWidth: "22rem", textAlign: "center" }}>{error}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} style={buttonStyle}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

const MB = 1024 * 1024;

// Small, non-blocking note that the view is a preview and full detail is on
// its way. Honest about what's on screen without getting in the way.
function DetailPill({ detail, onRetry }: { detail: NonNullable<DetailState>; onRetry: () => void }) {
  const text =
    "failed" in detail
      ? "Showing a preview. Full detail didn't load."
      : detail.total
        ? `Preview · loading full detail ${(detail.received / MB).toFixed(1)} of ${(detail.total / MB).toFixed(1)} MB`
        : "Preview · loading full detail";
  return (
    <div
      role="status"
      aria-live="polite"
      className="walkthrough-detail-pill"
      style={{
        position: "absolute",
        left: "50%",
        bottom: "calc(max(1rem, env(safe-area-inset-bottom)) + var(--consent-h, 0px))",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        maxWidth: "calc(100vw - 2rem)",
        padding: "0.4rem 0.8rem",
        borderRadius: "999px",
        background: "rgba(4, 44, 83, 0.62)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        boxShadow: "inset 0 1px 0 rgba(230, 241, 251, 0.45), 0 10px 24px -14px rgba(0, 0, 0, 0.6)",
        color: "var(--cloud)",
        fontSize: "0.8rem",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      <span>{text}</span>
      {"failed" in detail && (
        <button type="button" onClick={onRetry} style={{ ...buttonStyle, padding: "0.15rem 0.6rem", fontSize: "0.8rem" }}>
          Retry
        </button>
      )}
    </div>
  );
}

function Joystick({ base, stick }: { base: [number, number]; stick: [number, number] }) {
  const ring = (x: number, y: number, r: number, fill: string) => ({
    position: "fixed" as const,
    left: x - r,
    top: y - r,
    width: r * 2,
    height: r * 2,
    borderRadius: "50%",
    background: fill,
    pointerEvents: "none" as const,
  });
  return (
    <>
      <div
        style={{
          ...ring(base[0], base[1], 52, "rgba(230, 241, 251, 0.14)"),
          backdropFilter: "blur(10px) saturate(150%)",
          WebkitBackdropFilter: "blur(10px) saturate(150%)",
          boxShadow: "inset 0 1.5px 0 rgba(255, 255, 255, 0.55), inset 0 0 18px rgba(230, 241, 251, 0.12), 0 10px 24px -14px rgba(0, 0, 0, 0.6)",
        }}
      />
      <div style={{ ...ring(stick[0], stick[1], 22, "rgba(230, 241, 251, 0.9)"), boxShadow: "inset 0 1px 0 #fff, 0 6px 14px -6px rgba(0, 0, 0, 0.55)" }} />
    </>
  );
}

const overlayStyle = {
  position: "absolute" as const,
  inset: 0,
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
  color: "var(--cloud)",
  background: "var(--navy)",
};

const buttonStyle = {
  font: "inherit",
  padding: "0.6rem 1.2rem",
  borderRadius: "999px",
  border: "1px solid var(--mist)",
  background: "transparent",
  color: "var(--cloud)",
  cursor: "pointer",
};

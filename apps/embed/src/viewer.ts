import type * as PC from "playcanvas";
import type { CameraControls } from "playcanvas/scripts/esm/camera-controls.mjs";
import { normalizeScanPose, type ScanExperience } from "@visita/shared-types";
import { createWalkController } from "@visita/splat/walk-controller";

// The embed's PlayCanvas viewer: the consumer walkthrough's bundled-SOG path
// (apps/consumer/src/components/walkthrough/SplatViewer.tsx) without React.
// The preview .sog shows first, then the full scan replaces it in place. Once
// settled it renders on demand, so an idle embed leaves the GPU alone.

export type ViewerEvent =
  | { type: "progress"; label: string; received: number; total: number | null }
  | { type: "preparing" }
  | { type: "first-view"; preview: boolean }
  | { type: "detail-progress"; received: number; total: number | null }
  | { type: "complete" }
  | { type: "detail-failed" }
  | { type: "error"; message: string }
  | { type: "joystick"; base: [number, number]; stick: [number, number] }
  | { type: "joystick-end" };

export interface ViewerOptions {
  canvas: HTMLCanvasElement;
  src: string;
  previewSrc: string | null;
  experience: ScanExperience | null;
  maxPixelRatio: number;
  onEvent: (event: ViewerEvent) => void;
}

// Brand navy (#042C53) behind the scan.
const CLEAR_COLOR: [number, number, number] = [0.016, 0.173, 0.325];

/** Starts the viewer; the returned function tears it down. */
export function startViewer({ canvas, src, previewSrc, experience, maxPixelRatio, onEvent }: ViewerOptions): () => void {
  let disposed = false;
  let app: PC.Application | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const emit = (event: ViewerEvent) => {
    if (!disposed) onEvent(event);
  };
  const fail = (message: string) => emit({ type: "error", message });

  // iOS Safari drops WebGL contexts under memory pressure.
  const onContextLost = (event: Event) => {
    event.preventDefault();
    fail("The 3D view stopped, usually because the device ran low on memory.");
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

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
    instance.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    instance.setCanvasFillMode(pc.FILLMODE_NONE);
    instance.setCanvasResolution(pc.RESOLUTION_AUTO);
    instance.start();

    const gsplatSystem = instance.systems.gsplat;
    if (!gsplatSystem) throw new Error("gsplat system missing from this engine build");

    resizeObserver = new ResizeObserver(() => {
      instance.resizeCanvas(canvas.clientWidth, canvas.clientHeight);
      instance.renderNextFrame = true;
    });
    resizeObserver.observe(canvas);

    const camera = new pc.Entity("camera");
    camera.addComponent("camera", { clearColor: new pc.Color(...CLEAR_COLOR), fov: 60, nearClip: 0.05, farClip: 200 });
    const start = experience?.start ? normalizeScanPose(experience.start) : null;
    camera.setPosition(...(start?.position ?? [0, 0.8, 2.4]));
    if (start) camera.setEulerAngles(...start.rotation);
    instance.root.addChild(camera);
    camera.addComponent("script");
    const controls = camera.script!.create(Controls) as unknown as CameraControls;
    // Walk at eye height, like the walkthrough on visita.today: joystick on the
    // left half of a touch screen, drag to look on the right; WASD + drag on desktop.
    (controls as unknown as { _flyController: PC.FlyController })._flyController = createWalkController(pc, experience?.walkable);
    controls.enableOrbit = false;
    controls.enableFly = true;
    controls.enablePan = false;
    controls.moveSpeed = 2;
    controls.moveFastSpeed = 5;
    controls.moveSlowSpeed = 1;
    controls.mobileInputLayout = "joystick-touch";
    if (start) {
      const controlPose = (controls as unknown as { _pose: PC.Pose })._pose;
      const fly = (controls as unknown as { _flyController: { _pose: PC.Pose; _targetPose: PC.Pose } })._flyController;
      for (const item of [controlPose, fly._pose, fly._targetPose]) {
        item.position.set(...start.position);
        item.angles.set(...start.rotation);
      }
    }
    instance.on("joystick:left", (bx: number, by: number, sx: number, sy: number) => {
      emit(bx < 0 ? { type: "joystick-end" } : { type: "joystick", base: [bx, by], stick: [sx, sy] });
    });

    // On-demand rendering: redraw when the camera moves or the splat system asks.
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

    const loadAsset = (url: string, onBytes: (received: number, total: number | null) => void) =>
      new Promise<PC.Asset>((resolve, reject) => {
        const asset = new pc.Asset(url, "gsplat", { url });
        asset.on("progress", (r: number, t: number) => onBytes(r, t > 0 ? t : null));
        asset.once("load", () => resolve(asset));
        asset.once("error", (err: unknown) => reject(err));
        instance.assets.add(asset);
        instance.assets.load(asset);
      });

    const addScan = (asset: PC.Asset) => {
      const scan = new pc.Entity("scan");
      scan.addComponent("gsplat", { asset });
      // Scans are exported Y-down.
      scan.setLocalEulerAngles(...(experience?.rotation ?? [180, 0, 0]));
      instance.root.addChild(scan);
      return scan;
    };

    const splatCount = (asset: PC.Asset) => (asset.resource as { numSplats?: number } | null)?.numSplats ?? 0;

    // Resolves true once a rendered frame is fully loaded and sorted and its
    // drawn splat count satisfies `accept`; false after `timeoutMs`.
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

    let preview: PC.Entity | null = null;
    let previewAsset: PC.Asset | null = null;

    if (previewSrc) {
      try {
        previewAsset = await loadAsset(previewSrc, (received, total) =>
          emit({ type: "progress", label: "Loading a preview of the room", received, total }),
        );
      } catch {
        previewAsset = null; // No usable preview: load the full scan on its own.
      }
      if (disposed) return;
    }

    if (previewAsset) {
      emit({ type: "preparing" });
      preview = addScan(previewAsset);
      await drawn((n) => n > 0);
      if (disposed) return;
      emit({ type: "first-view", preview: true });
    }

    let fullAsset: PC.Asset;
    try {
      fullAsset = await loadAsset(src, (received, total) =>
        emit(preview ? { type: "detail-progress", received, total } : { type: "progress", label: "Downloading the scan", received, total }),
      );
    } catch {
      // Keep the preview on screen; it's still the real room.
      if (preview) emit({ type: "detail-failed" });
      else fail("The walkthrough didn't load. Check your connection and try again.");
      return;
    }
    if (disposed) return;

    if (!preview) emit({ type: "preparing" });
    const previewSplats = previewAsset ? splatCount(previewAsset) : 0;
    const full = addScan(fullAsset);

    if (preview && previewAsset) {
      // Remove the preview only once frames draw more than it alone, so the
      // swap leaves no gap; free its memory only after a frame without it.
      if (!(await drawn((n) => n > previewSplats))) {
        if (disposed) return;
        full.destroy();
        emit({ type: "detail-failed" });
        return;
      }
      if (disposed) return;
      preview.destroy();
      await drawn();
      if (disposed) return;
      previewAsset.unload();
      instance.assets.remove(previewAsset);
    } else {
      await drawn((n) => n > 0);
      if (disposed) return;
      emit({ type: "first-view", preview: false });
    }
    emit({ type: "complete" });
    instance.autoRender = false;
    instance.renderNextFrame = true;
  })().catch(() => fail("The 3D viewer couldn't start on this device."));

  return () => {
    disposed = true;
    resizeObserver?.disconnect();
    canvas.removeEventListener("webglcontextlost", onContextLost);
    app?.destroy();
    app = null;
  };
}

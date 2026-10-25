import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ScanPose, Point2, Vec3 } from "@visita/shared-types";
import { constrainWalkStep, normalizeScanPose } from "@visita/shared-types";

export interface ScanPreviewHandle {
  pose(): ScanPose | null;
  goTo(pose: ScanPose): void;
  focus(): void;
}

interface Props {
  src: string;
  rotation: Vec3;
  walkable: Point2[];
  testBoundary: boolean;
  onPose: (pose: ScanPose) => void;
  onReady?: () => void;
}

/** The admin's free-moving scan preview. W/A/S/D walk, Q/E change height, drag to look. */
export const ScanPreview = forwardRef<ScanPreviewHandle, Props>(function ScanPreview({ src, rotation, walkable, testBoundary, onPose, onReady }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ pose: ScanPose; setPose: (pose: ScanPose) => void } | null>(null);
  const options = useRef({ rotation, walkable, testBoundary, onPose, onReady });
  options.current = { rotation, walkable, testBoundary, onPose, onReady };
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    pose: () => state.current ? { position: [...state.current.pose.position] as Vec3, rotation: [...state.current.pose.rotation] as Vec3 } : null,
    goTo: (pose) => state.current?.setPose(pose),
    focus: () => canvasRef.current?.focus(),
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let app: import("playcanvas").Application | null = null;
    let observer: ResizeObserver | null = null;
    let removeInput = () => {};
    setReady(false);
    setError(null);

    void import("playcanvas").then((pc) => {
      if (disposed) return;
      const instance = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: false, alpha: false, powerPreference: "high-performance" } });
      app = instance;
      instance.graphicsDevice.maxPixelRatio = Math.min(devicePixelRatio || 1, 1.5);
      instance.setCanvasFillMode(pc.FILLMODE_NONE);
      instance.setCanvasResolution(pc.RESOLUTION_AUTO);
      instance.start();
      const camera = new pc.Entity("admin-camera");
      camera.addComponent("camera", { clearColor: new pc.Color(0.016, 0.173, 0.325), nearClip: 0.05, farClip: 200, fov: 65 });
      instance.root.addChild(camera);
      const pose: ScanPose = { position: [0, 0.8, 2.4], rotation: [0, 0, 0] };
      const setPose = (next: ScanPose) => {
        const normalized = normalizeScanPose(next);
        pose.position = normalized.position;
        pose.rotation = normalized.rotation;
        camera.setPosition(...pose.position);
        camera.setEulerAngles(...pose.rotation);
        instance.renderNextFrame = true;
      };
      state.current = { pose, setPose };
      setPose(pose);
      observer = new ResizeObserver(() => { instance.resizeCanvas(canvas.clientWidth, canvas.clientHeight); instance.renderNextFrame = true; });
      observer.observe(canvas);

      const keys = new Set<string>();
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.focus(); };
      const move = (e: PointerEvent) => {
        if (!dragging) return;
        pose.rotation[0] = Math.max(-89, Math.min(89, pose.rotation[0] - (e.clientY - lastY) * 0.16));
        pose.rotation[1] -= (e.clientX - lastX) * 0.16;
        lastX = e.clientX; lastY = e.clientY;
        setPose(pose);
      };
      const up = () => { dragging = false; };
      const keydown = (e: KeyboardEvent) => {
        if (document.activeElement !== canvas) return;
        if (["w", "a", "s", "d", "q", "e", "shift", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
          keys.add(e.key.toLowerCase()); e.preventDefault();
        }
      };
      const keyup = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
      const blur = () => keys.clear();
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
      window.addEventListener("keydown", keydown);
      window.addEventListener("keyup", keyup);
      window.addEventListener("blur", blur);
      removeInput = () => {
        canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up);
        window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); window.removeEventListener("blur", blur);
      };

      let lastReport = 0;
      const heading = new pc.Quat();
      const forwardDirection = new pc.Vec3();
      const rightDirection = new pc.Vec3();
      instance.on("update", (dt: number) => {
        if (disposed) return;
        const forward = Number(keys.has("w") || keys.has("arrowup")) - Number(keys.has("s") || keys.has("arrowdown"));
        const strafe = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
        const vertical = Number(keys.has("e")) - Number(keys.has("q"));
        if (forward || strafe || vertical) {
          // Use the same yaw-only PlayCanvas basis as the public walkthrough.
          // The old hand-written sine/cosine signs made W and A feel rotated.
          heading.setFromEulerAngles(0, pose.rotation[1], 0);
          heading.transformVector(pc.Vec3.FORWARD, forwardDirection);
          heading.transformVector(pc.Vec3.RIGHT, rightDirection);
          const speed = (keys.has("shift") ? 4 : 1.5) * Math.min(dt, 0.05) / Math.hypot(forward, strafe, vertical);
          const next: ScanPose = { position: [
            pose.position[0] + (forwardDirection.x * forward + rightDirection.x * strafe) * speed,
            pose.position[1] + vertical * speed,
            pose.position[2] + (forwardDirection.z * forward + rightDirection.z * strafe) * speed,
          ], rotation: [...pose.rotation] };
          const { walkable: area, testBoundary } = options.current;
          if (testBoundary && area.length >= 3) {
            const limited = constrainWalkStep([pose.position[0], pose.position[2]], [next.position[0], next.position[2]], area);
            next.position[0] = limited[0]; next.position[2] = limited[1]; next.position[1] = pose.position[1];
          }
          setPose(next);
        }
        if (performance.now() - lastReport > 250) {
          lastReport = performance.now();
          options.current.onPose({ position: [...pose.position], rotation: [...pose.rotation] });
        }
      });

      const asset = new pc.Asset(src, "gsplat", { url: src });
      asset.once("load", () => {
        if (disposed) return;
        const scan = new pc.Entity("scan");
        scan.addComponent("gsplat", { asset });
        instance.root.addChild(scan);
        let previous = "";
        instance.on("update", () => {
          const value = options.current.rotation.join(",");
          if (value !== previous) { scan.setLocalEulerAngles(...options.current.rotation); previous = value; instance.renderNextFrame = true; }
        });
        setReady(true);
        options.current.onReady?.();
      });
      asset.once("error", () => { if (!disposed) setError("Couldn't load this scan. Check that the file uploaded successfully."); });
      instance.assets.add(asset);
      instance.assets.load(asset);
    }).catch(() => { if (!disposed) setError("The 3D preview couldn't start on this device."); });

    return () => { disposed = true; removeInput(); observer?.disconnect(); state.current = null; app?.destroy(); };
  }, [src]);

  return <div className="relative h-[min(62vh,48rem)] min-h-80 overflow-hidden rounded-card bg-[#042c53] xl:h-full">
    <canvas ref={canvasRef} tabIndex={0} aria-label="Scan setup preview. Click and drag to look; W A S D move; Q and E change height." className="h-full w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary" />
    {!ready && !error && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-white">Loading scan…</p>}
    {error && <p role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white">{error}</p>}
  </div>;
});

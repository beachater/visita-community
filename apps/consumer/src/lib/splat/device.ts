// What this device can handle, checked before the viewer mounts (PRD 5.6 step 7).
// Heuristics, not guarantees: phone tests are what tune these numbers.

export interface DeviceProfile {
  webgl2: boolean;
  /** GB, rounded down by the browser. Chrome/Android only; null on iOS and Firefox. */
  deviceMemory: number | null;
  cores: number | null;
  isMobile: boolean;
  isIOS: boolean;
  /** Unmasked GPU name where the browser exposes it. */
  gpu: string | null;
  /** Streamed SOG splat budget (fixed .sog files ignore it). */
  splatBudget: number;
  /** Cap on device pixel ratio. Splats are fill-rate bound, so extra pixels cost most. */
  maxPixelRatio: number;
  /** Likely to struggle: show a warning and let the visitor choose. */
  lowEnd: boolean;
}

export function getDeviceProfile(): DeviceProfile {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const ua = nav.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  const isMobile = isIOS || /Android|Mobi/.test(ua);

  let webgl2 = false;
  let gpu: string | null = null;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl) {
      webgl2 = true;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webgl2 = false;
  }

  const deviceMemory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null;
  const lowEnd = (deviceMemory !== null && deviceMemory <= 2) || (cores !== null && cores <= 4 && isMobile);

  return {
    webgl2,
    deviceMemory,
    cores,
    isMobile,
    isIOS,
    gpu,
    splatBudget: lowEnd ? 500_000 : isMobile ? 1_000_000 : 3_000_000,
    maxPixelRatio: isMobile ? 1 : 1.5,
    lowEnd,
  };
}

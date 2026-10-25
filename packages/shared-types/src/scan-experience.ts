export type Point2 = [number, number]; // X, Z in the oriented scan
export type Vec3 = [number, number, number];

export interface ScanPose {
  position: Vec3;
  rotation: Vec3; // PlayCanvas Euler degrees: pitch, yaw, roll
}

export interface ScanStop {
  id: string;
  label: string;
  pose: ScanPose;
}

export interface ScanExperience {
  rotation: Vec3; // transform applied to the .sog entity
  start: ScanPose | null;
  walkable: Point2[];
  stops: ScanStop[];
}

export const emptyScanExperience = (): ScanExperience => ({
  rotation: [180, 0, 0],
  start: null,
  walkable: [],
  stops: [],
});

/** Keep saved camera yaw within one turn for PlayCanvas pose interpolation. */
export function normalizeScanPose(value: ScanPose): ScanPose {
  const yaw = ((value.rotation[1] % 360) + 360) % 360;
  return {
    position: [...value.position],
    rotation: [value.rotation[0], yaw > 180 ? yaw - 360 : yaw, value.rotation[2]],
  };
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const vec = (v: unknown, n: number): v is number[] => Array.isArray(v) && v.length === n && v.every(finite);
const pose = (v: unknown): v is ScanPose => Boolean(v && typeof v === "object" && vec((v as ScanPose).position, 3) && vec((v as ScanPose).rotation, 3));
const turn = (a: Point2, b: Point2, c: Point2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const crosses = (a: Point2, b: Point2, c: Point2, d: Point2) => {
  const abC = turn(a, b, c), abD = turn(a, b, d);
  const cdA = turn(c, d, a), cdB = turn(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0;
};

export function insideWalkable([x, z]: Point2, polygon: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i]!;
    const [xj, zj] = polygon[j]!;
    const cross = (zj - zi) * (x - xi) - (xj - xi) * (z - zi);
    if (Math.abs(cross) < 1e-7 && x >= Math.min(xi, xj) - 1e-7 && x <= Math.max(xi, xj) + 1e-7 && z >= Math.min(zi, zj) - 1e-7 && z <= Math.max(zi, zj) + 1e-7) return true;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Constrain a small walking step and let the visitor slide along a boundary. */
export function constrainWalkStep(from: Point2, to: Point2, polygon: Point2[]): Point2 {
  if (polygon.length < 3 || !insideWalkable(from, polygon)) return from;
  const clear = (end: Point2) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(end[0] - from[0], end[1] - from[1]) / 0.1));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!insideWalkable([from[0] + (end[0] - from[0]) * t, from[1] + (end[1] - from[1]) * t], polygon)) return false;
    }
    return true;
  };
  if (clear(to)) return to;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    const candidate: Point2 = [from[0] + (to[0] - from[0]) * mid, from[1] + (to[1] - from[1]) * mid];
    if (clear(candidate)) low = mid;
    else high = mid;
  }
  const hit: Point2 = [from[0] + (to[0] - from[0]) * low, from[1] + (to[1] - from[1]) * low];
  // Project the remaining motion onto the wall actually reached. World-axis
  // fallbacks make diagonal walking veer toward X or Z at angled walls.
  let best = hit;
  let bestDistance = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq < 1e-10) continue;
    const t = Math.max(0, Math.min(1, ((hit[0] - a[0]) * dx + (hit[1] - a[1]) * dz) / lengthSq));
    const edgePoint: Point2 = [a[0] + t * dx, a[1] + t * dz];
    if (Math.hypot(hit[0] - edgePoint[0], hit[1] - edgePoint[1]) > 0.001) continue;
    const remaining = ((to[0] - hit[0]) * dx + (to[1] - hit[1]) * dz) / lengthSq;
    const endT = Math.max(0, Math.min(1, t + remaining));
    const end: Point2 = [a[0] + endT * dx, a[1] + endT * dz];
    const distance = Math.hypot(end[0] - hit[0], end[1] - hit[1]);
    if (distance > bestDistance && clear(end)) { best = end; bestDistance = distance; }
  }
  return best;
}

export function scanExperienceError(value: ScanExperience): string | null {
  if (!vec(value.rotation, 3)) return "Set a valid scan orientation.";
  if (!pose(value.start)) return "Set the starting view.";
  if (value.walkable.length < 3 || value.walkable.some((p) => !vec(p, 2))) return "Add at least three walkable-area corners.";
  let area = 0;
  for (let i = 0; i < value.walkable.length; i++) {
    const a = value.walkable[i]!;
    const b = value.walkable[(i + 1) % value.walkable.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  for (let i = 0; i < value.walkable.length; i++) {
    for (let j = i + 2; j < value.walkable.length; j++) {
      if (i === 0 && j === value.walkable.length - 1) continue;
      if (crosses(value.walkable[i]!, value.walkable[(i + 1) % value.walkable.length]!, value.walkable[j]!, value.walkable[(j + 1) % value.walkable.length]!)) return "The walkable area crosses itself. Reorder its corners.";
    }
  }
  if (Math.abs(area) < 0.01) return "The walkable area is too small.";
  if (!insideWalkable([value.start.position[0], value.start.position[2]], value.walkable)) return "The starting view is outside the walkable area.";
  if (value.stops.length > 20) return "Keep the tour to 20 stops or fewer.";
  for (const stop of value.stops) {
    if (!stop.id || !stop.label.trim() || stop.label.length > 80 || !pose(stop.pose)) return "Each stop needs a name and a valid view.";
    if (Math.abs(stop.pose.position[1] - value.start.position[1]) > 0.15) return `“${stop.label}” needs the same eye height as the start view.`;
    if (!insideWalkable([stop.pose.position[0], stop.pose.position[2]], value.walkable)) return `“${stop.label}” is outside the walkable area.`;
  }
  return null;
}

export function parseScanExperience(raw: unknown): ScanExperience | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<ScanExperience>;
  if (!vec(data.rotation, 3) || !pose(data.start) || !Array.isArray(data.walkable) || !Array.isArray(data.stops)) return null;
  const value = data as ScanExperience;
  return scanExperienceError(value) ? null : value;
}

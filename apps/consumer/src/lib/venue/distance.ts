// Straight-line distance from the visitor to a venue (PRD 4.1 "Distance").
// Location stays on the device: it's read in the browser and never sent.

export interface Coords {
  lat: number;
  lng: number;
}

export function haversineMeters(a: Coords, b: Coords): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "350 m away", "1.2 km away", "12 km away". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m away`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

/** Whether location was already allowed, so we can read it without prompting. */
export async function locationAlreadyAllowed(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    return status?.state === "granted";
  } catch {
    return false;
  }
}

export function currentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Location isn't available in this browser."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 },
    );
  });
}

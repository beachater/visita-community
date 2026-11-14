// Platform settings an admin flips in the admin app (platform_settings, one
// row, publicly readable). Read in the browser on each page load so a change
// applies without a rebuild. Anything going wrong reads as "all switches off",
// which is always today's behaviour.

export interface PlatformSettings {
  /** "Get directions" shows the route inside Visita instead of handing off. */
  inAppDirections: boolean;
}

export const DEFAULT_SETTINGS: PlatformSettings = { inAppDirections: false };

/** Turn the REST response into settings; anything unexpected is the default. */
export function parseSettings(rows: unknown): PlatformSettings {
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || typeof row !== "object") return DEFAULT_SETTINGS;
  return { inAppDirections: (row as { in_app_directions?: unknown }).in_app_directions === true };
}

let pending: Promise<PlatformSettings> | null = null;

/** The settings, fetched once per page load and shared by every caller. */
export function loadPlatformSettings(): Promise<PlatformSettings> {
  pending ??= fetchSettings();
  return pending;
}

async function fetchSettings(): Promise<PlatformSettings> {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return DEFAULT_SETTINGS;
  try {
    const res = await fetch(`${url}/rest/v1/platform_settings?select=in_app_directions&limit=1`, { headers: { apikey: key } });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return parseSettings(await res.json());
  } catch (err) {
    console.warn("[settings] couldn't load platform settings; using defaults", err);
    return DEFAULT_SETTINGS;
  }
}

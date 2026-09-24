// Build-time reads for prerendered pages, through Supabase's public REST API
// with the publishable key, so RLS applies exactly as it does for visitors.
// Plain fetch keeps the Supabase client out of prerender-only code.

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * GET /rest/v1/<path>. Returns [] (with a warning) when Supabase isn't
 * configured, so a build without .env still succeeds with no venue pages.
 */
export async function readPublic<T>(path: string): Promise<T[]> {
  if (!url || !key) {
    console.warn(`[public-data] PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY not set; skipping ${path}`);
    return [];
  }
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key } });
  if (!res.ok) {
    throw new Error(`[public-data] ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T[]>;
}

import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import type { Database } from "@visita/shared-types";

// Supabase client for one request, acting as the signed-in visitor (RLS
// applies). Sessions live in cookies set by @supabase/ssr (PRD 5.2).

export type ServerSupabase = ReturnType<typeof createServerClient<Database>>;

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const authConfigured = Boolean(url && key);

/**
 * `headers` collects the response headers Supabase asks for when it
 * refreshes a session (no shared caching of that response).
 */
export function createSupabase(request: Request, cookies: AstroCookies, headers: Headers): ServerSupabase | null {
  if (!url || !key) return null;
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () =>
        parseCookieHeader(request.headers.get("cookie") ?? "").map(({ name, value }) => ({ name, value: value ?? "" })),
      setAll(toSet, extra) {
        for (const { name, value, options } of toSet) cookies.set(name, value, options);
        for (const [k, v] of Object.entries(extra ?? {})) headers.set(k, v);
      },
    },
  });
}

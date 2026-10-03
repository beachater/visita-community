import { defineMiddleware } from "astro:middleware";
import { createSupabase } from "./lib/auth/supabase-server";
import { cacheKeyFor, isEdgeCacheable, PUBLIC_CACHE_CONTROL } from "./lib/server/edge-cache";

// Reads the visitor's session for server-rendered requests (PRD 5.2).
// Prerendered pages never run this at request time, so personalized UI on
// those pages goes in server islands (see AccountMenu).
//
// Pages that are the same for every visitor (cafe pages, the map's venue
// list) skip the session entirely and are cached at the edge for 5 minutes
// (plan Task 1b). Skipping the session also means they can never carry a
// refreshed-session Set-Cookie into the shared cache.
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.supabase = null;
  // Scans and tiles stream from R2 with no per-visitor state.
  const path = context.url.pathname;
  if (context.isPrerendered || path.startsWith("/assets/") || path.startsWith("/lab/assets/")) return next();

  if (isEdgeCacheable(context.request.method, path)) return publicCached(context.request, next);

  const extra = new Headers();
  const supabase = createSupabase(context.request, context.cookies, extra);
  context.locals.supabase = supabase;
  if (supabase) {
    // getClaims verifies the token (refreshing it when due); getSession alone
    // would trust whatever the cookie says.
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (claims?.sub) context.locals.user = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
  }

  const response = await next();
  extra.forEach((value, name) => response.headers.set(name, value));
  // Server islands carry per-visitor content (account menu, your review); never cache them.
  if (path.startsWith("/_server-islands/")) response.headers.set("cache-control", "private, no-store");
  return response;
});

async function publicCached(request: Request, next: () => Promise<Response>): Promise<Response> {
  // The Workers Cache API; absent in some dev runtimes and a no-op on *.workers.dev.
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(cacheKeyFor(request.url), { method: "GET" });
  const hit = cache ? await cache.match(key).catch(() => undefined) : undefined;
  if (hit) return request.method === "HEAD" ? new Response(null, hit) : hit;

  const response = await next();
  if (response.status !== 200 || response.headers.has("set-cookie")) return response;
  response.headers.set("cache-control", PUBLIC_CACHE_CONTROL);
  if (cache) await cache.put(key, response.clone()).catch(() => undefined);
  return response;
}

import type { APIRoute } from "astro";

export const prerender = false;

// Proxies scans from the public bucket onto the app's own origin, for /lab
// only. Same-origin responses give the Resource Timing API exact byte counts,
// which cross-origin r2.dev responses hide. Visitors never go through this.
export const GET: APIRoute = async ({ params }) => {
  const key = params.key ?? "";
  const base = import.meta.env.PUBLIC_ASSETS_BASE_URL;
  if (!base || !key.startsWith("splats/")) return new Response("Not found", { status: 404 });

  const upstream = await fetch(`${base.replace(/\/+$/, "")}/${key}`);
  if (!upstream.ok) return new Response("Not found", { status: upstream.status === 404 ? 404 : 502 });

  const headers = new Headers();
  for (const name of ["content-type", "content-length", "etag"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Every lab run downloads for real, so measurements aren't served from cache.
  headers.set("cache-control", "no-store");
  return new Response(upstream.body, { headers });
};

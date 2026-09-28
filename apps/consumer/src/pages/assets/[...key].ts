import type { APIRoute } from "astro";
import { serveAsset } from "../../lib/assets/r2-route";

// Public assets (scans, the basemap) from R2, on Visita's own domain, with
// byte ranges and ETag revalidation. Keys are versioned, so files are immutable.
export const prerender = false;

export const GET: APIRoute = ({ request, params }) => serveAsset(request, params.key ?? "", { withBody: true });
export const HEAD: APIRoute = ({ request, params }) => serveAsset(request, params.key ?? "", { withBody: false });

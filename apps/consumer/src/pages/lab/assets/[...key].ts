import type { APIRoute } from "astro";
import { serveAsset } from "../../../lib/assets/r2-route";

// Lab copy of /assets that is never cached, so every walkthrough-lab run
// downloads for real and its byte counts are honest.
export const prerender = false;

export const GET: APIRoute = ({ request, params }) => serveAsset(request, params.key ?? "", { withBody: true, noStore: true });

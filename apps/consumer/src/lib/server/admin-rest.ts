import { env } from "cloudflare:workers";

// Service-role access to Supabase's REST API, for Worker routes only (PRD 5.5:
// logic that shouldn't live client-side). The secret key is a Worker secret,
// never shipped to browsers.

export class ServiceUnavailable extends Error {}

export async function adminRest(path: string, init: RequestInit = {}): Promise<Response> {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new ServiceUnavailable("Supabase isn't configured for this deployment.");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${url.replace(/\/+$/, "")}/rest/v1/${path}`, { ...init, headers });
}

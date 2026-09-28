import type { APIRoute } from "astro";
import { safeNext } from "../../lib/auth/next";

// GET /auth/callback: Google sends visitors back here with a one-time code,
// which becomes the session cookie.
export const prerender = false;

export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  if (!code || !locals.supabase) return redirect(`/auth/login?error=callback&next=${encodeURIComponent(next)}`, 303);

  const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
  if (error) return redirect(`/auth/login?error=callback&next=${encodeURIComponent(next)}`, 303);
  return redirect(next, 303);
};

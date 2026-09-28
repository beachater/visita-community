import type { APIRoute } from "astro";
import { safeNext } from "../../lib/auth/next";

// POST /auth/google: start Google sign-in, the only provider (PRD 4.2).
// Supabase stores the PKCE verifier in a cookie and returns Google's URL.
export const prerender = false;

export const POST: APIRoute = async ({ request, url, locals, redirect }) => {
  const form = await request.formData().catch(() => null);
  const next = safeNext(form?.get("next")?.toString());
  if (!locals.supabase) return redirect(`/auth/login?error=unavailable&next=${encodeURIComponent(next)}`, 303);

  const callback = new URL("/auth/callback", url.origin);
  callback.searchParams.set("next", next);
  const { data, error } = await locals.supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });
  if (error || !data.url) return redirect(`/auth/login?error=google&next=${encodeURIComponent(next)}`, 303);
  return redirect(data.url, 303);
};

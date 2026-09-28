import type { APIRoute } from "astro";

// POST /auth/logout: end the session on this device. POST (not a link) so a
// stray image or prefetch can't sign anyone out; Astro's origin check covers
// cross-site forms.
export const prerender = false;

export const POST: APIRoute = async ({ locals, redirect }) => {
  await locals.supabase?.auth.signOut({ scope: "local" });
  return redirect("/", 303);
};

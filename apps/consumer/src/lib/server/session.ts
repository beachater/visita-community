import type { APIContext } from "astro";

// Shared by the account APIs: a JSON response helper, and the signed-in
// visitor's Supabase client (RLS applies) or the response to send instead.

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });

export type Session =
  | { ok: false; response: Response }
  | { ok: true; supabase: NonNullable<App.Locals["supabase"]>; user: NonNullable<App.Locals["user"]> };

export function requireSession({ locals }: APIContext, signInMessage: string): Session {
  if (!locals.supabase) return { ok: false, response: json(503, { error: "Accounts aren't available yet." }) };
  if (!locals.user) return { ok: false, response: json(401, { error: signInMessage }) };
  return { ok: true, supabase: locals.supabase, user: locals.user };
}

/** Published venue id for a slug, via the visitor's client. */
export async function publishedVenueId(supabase: NonNullable<App.Locals["supabase"]>, slug: string): Promise<string | null> {
  const { data, error } = await supabase.from("venues").select("id").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

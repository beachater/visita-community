import { defineMiddleware } from "astro:middleware";
import { createSupabase } from "./lib/auth/supabase-server";

// Reads the visitor's session for server-rendered requests (PRD 5.2).
// Prerendered pages never run this at request time, so personalized UI on
// those pages goes in server islands (see AccountMenu).
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.supabase = null;
  // Scans and tiles stream from R2 with no per-visitor state.
  const path = context.url.pathname;
  if (context.isPrerendered || path.startsWith("/assets/") || path.startsWith("/lab/assets/")) return next();

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
  return response;
});

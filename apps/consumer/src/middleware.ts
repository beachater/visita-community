import { defineMiddleware } from "astro:middleware";

// TODO(auth): create a Supabase server client with @supabase/ssr cookie
// helpers, read the session, and populate locals.user (PRD 5.2). Prerendered
// pages never run this at request time, so personalized UI on those pages
// goes in server islands.
export const onRequest = defineMiddleware((context, next) => {
  context.locals.user = null;
  return next();
});

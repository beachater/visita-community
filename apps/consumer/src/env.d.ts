/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  /** R2 public base; `venues.splat_url` keys are resolved against it. */
  readonly PUBLIC_ASSETS_BASE_URL?: string;
}

// Wrangler cannot infer deployed secrets from wrangler.jsonc during CI type
// generation. This binding is provisioned as a Worker secret, not a var.
declare namespace Cloudflare {
  interface Env {
    SUPABASE_SECRET_KEY: string;
  }
}

declare namespace App {
  interface Locals {
    /** Signed-in user, populated by middleware. Null when signed out. */
    user: { id: string; email: string | null } | null;
    /** Supabase acting as the visitor (RLS applies). Null when prerendering or unconfigured. */
    supabase: import("./lib/auth/supabase-server").ServerSupabase | null;
  }
}

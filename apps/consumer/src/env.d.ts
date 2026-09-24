/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

declare namespace App {
  interface Locals {
    /** Signed-in user, populated by middleware. Null when signed out. */
    user: { id: string; email: string | null } | null;
  }
}

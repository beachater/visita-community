import { createClient } from "@supabase/supabase-js";
import type { Database } from "@visita/shared-types";

// The owner and admin app talks to Supabase directly as the signed-in person.
// RLS and security-definer functions decide what they can do (PRD 5.3); the
// app's own route guards are only for getting around.

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set (see .env.example).");

export const supabase = createClient<Database>(url, key, {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const CONSUMER_URL = (import.meta.env.VITE_CONSUMER_URL ?? "https://visita.ph").replace(/\/+$/, "");

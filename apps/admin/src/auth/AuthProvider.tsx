import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { ClaimSummary } from "@/routes/home";

// Who's signed in, and what they are here: an admin, an owner, a claimant.
// Loaded once per session and refreshed after a claim changes.

export interface MyClaim extends ClaimSummary {
  venueName: string | null;
  venueSlug: string | null;
  venuePublished: boolean;
  proposedName: string | null;
  roleTitle: string;
  hasProof: boolean;
  reviewNote: string | null;
  createdAt: string;
}

interface Access {
  isAdmin: boolean;
  claims: MyClaim[];
}

interface AuthState {
  session: Session | null;
  /** True until both the session and (when signed in) access are known. */
  loading: boolean;
  access: Access | null;
  accessError: string | null;
  refreshAccess: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function loadAccess(userId: string): Promise<Access> {
  const [admin, claims] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase
      .from("venue_owners")
      .select("id, status, venue_id, role_title, proof_key, review_note, created_at, proposed_venue, venues(name, slug, is_published)")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  if (admin.error) throw admin.error;
  if (claims.error) throw claims.error;
  return {
    isAdmin: admin.data === true,
    claims: (claims.data ?? []).map((c) => ({
      id: c.id,
      status: c.status,
      venueId: c.venue_id,
      venueName: c.venues?.name ?? null,
      venueSlug: c.venues?.slug ?? null,
      venuePublished: c.venues?.is_published ?? false,
      proposedName: (c.proposed_venue as { name?: string } | null)?.name ?? null,
      roleTitle: c.role_title,
      hasProof: Boolean(c.proof_key),
      reviewNote: c.review_note,
      createdAt: c.created_at,
    })),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionKnown, setSessionKnown] = useState(false);
  const [access, setAccess] = useState<Access | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionKnown(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setSessionKnown(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  const refreshAccess = useCallback(async () => {
    if (!userId) {
      setAccess(null);
      return;
    }
    try {
      setAccess(await loadAccess(userId));
      setAccessError(null);
    } catch (err) {
      console.error("[access]", err);
      setAccessError("Couldn't load your account. Check your connection and reload.");
    }
  }, [userId]);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading: !sessionKnown || (Boolean(userId) && access === null && accessError === null),
      access,
      accessError,
      refreshAccess,
      signInWithGoogle: async () => {
        await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
      },
      signOut: async () => {
        await supabase.auth.signOut({ scope: "local" });
        setAccess(null);
      },
    }),
    [session, sessionKnown, userId, access, accessError, refreshAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

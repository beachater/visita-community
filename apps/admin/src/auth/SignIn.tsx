import { useState } from "react";
import { Navigate } from "react-router";
import { Button } from "@visita/ui/button";
import { useAuth } from "./AuthProvider";

// Google is the only way in, for owners and admins alike (PRD 4.3/4.4).
export function SignIn() {
  const { session, loading, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  if (!loading && session) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-accent/70 via-background to-background p-4 sm:p-6">
      <div className="grid w-full max-w-md gap-6 rounded-sheet border border-border/60 bg-card/95 p-6 shadow-card sm:p-10">
        <div className="grid gap-2">
          <p className="font-display text-2xl font-bold text-primary">Visita <span className="font-sans text-sm font-medium text-muted-foreground">for cafes</span></p>
          <h1 className="font-display text-4xl font-bold leading-tight">Manage your cafe on Visita</h1>
          <p className="text-muted-foreground">
            Claim your listing, keep your menu and hours right, and see how visitors find you.
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-2xl border border-destructive/40 bg-background px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          size="lg"
          onClick={async () => {
            setError(null);
            try {
              await signInWithGoogle();
            } catch {
              setError("Google sign-in didn't start. Try again.");
            }
          }}
        >
          Continue with Google
        </Button>
        <p className="text-xs text-muted-foreground">Sign in with the Google account you'll use to manage the cafe.</p>
      </div>
    </div>
  );
}

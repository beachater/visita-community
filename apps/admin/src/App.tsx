import type { ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { LogOut } from "lucide-react";
import { Button } from "@visita/ui/button";
import { Toaster } from "@visita/ui/sonner";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { SignIn } from "@/auth/SignIn";
import { homeFor } from "@/routes/home";
import { ClaimPage } from "@/pages/claim/ClaimPage";
import { StatusPage } from "@/pages/pending/StatusPage";
import { ApprovalsPage } from "@/pages/admin/approvals/ApprovalsPage";
import { Analytics } from "@/pages/venue/Analytics";
import { EventsEditor } from "@/pages/venue/EventsEditor";
import { ListingEditor } from "@/pages/venue/ListingEditor";
import { Reviews } from "@/pages/venue/Reviews";
import { VenueDashboard } from "@/pages/venue/VenueDashboard";
import { VenueLayout } from "@/pages/venue/VenueLayout";
import { VenuesPage } from "@/pages/venue/VenuesPage";

// Owner and admin app (PRD 4.4, 4.5). Access is enforced by Supabase RLS, not
// by these routes (PRD 5.3); the guards only send people to the right place.

function Centered({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center p-6 text-center">{children}</div>;
}

function Shell() {
  const { access, signOut, session } = useAuth();
  const name = (session?.user.user_metadata?.full_name as string | undefined) ?? session?.user.email ?? "";
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link to="/" className="font-display text-xl font-bold">
            Visita <span className="text-sm font-normal text-muted-foreground">for cafes</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {access?.isAdmin && (
              <Link to="/admin/approvals" className="rounded-md px-2 py-1 hover:bg-accent">
                Approvals
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="hidden max-w-48 truncate text-muted-foreground sm:inline">{name}</span>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function RequireSignIn() {
  const { session, loading, accessError, refreshAccess } = useAuth();
  const location = useLocation();
  if (loading) return <Centered><p className="text-muted-foreground">Loading…</p></Centered>;
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  if (accessError)
    return (
      <Centered>
        <div className="grid justify-items-center gap-3">
          <p role="alert">{accessError}</p>
          <Button variant="outline" onClick={() => void refreshAccess()}>
            Try again
          </Button>
        </div>
      </Centered>
    );
  return <Shell />;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { access } = useAuth();
  return access?.isAdmin ? children : <Navigate to="/" replace />;
}

function Home() {
  const { access } = useAuth();
  // Never guess: without access loaded, an owner would be sent to the claim form.
  if (!access) return <Centered><p className="text-muted-foreground">Loading…</p></Centered>;
  return <Navigate to={homeFor(access)} replace />;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route element={<RequireSignIn />}>
            <Route index element={<Home />} />
            <Route path="claim" element={<ClaimPage />} />
            <Route path="status" element={<StatusPage />} />
            <Route path="venues" element={<VenuesPage />} />
            <Route path="venue/:venueId" element={<VenueLayout />}>
              <Route index element={<VenueDashboard />} />
              <Route path="listing" element={<ListingEditor />} />
              <Route path="events" element={<EventsEditor />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="analytics" element={<Analytics />} />
            </Route>
            <Route path="admin/approvals" element={<RequireAdmin><ApprovalsPage /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" />
    </AuthProvider>
  );
}

import type { ReactNode } from "react";
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router";
import { LogOut } from "lucide-react";
import { Button } from "@visita/ui/button";
import { Toaster } from "@visita/ui/sonner";
import { cn } from "@visita/ui/utils";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { SignIn } from "@/auth/SignIn";
import { homeFor } from "@/routes/home";
import { ClaimPage } from "@/pages/claim/ClaimPage";
import { StatusPage } from "@/pages/pending/StatusPage";
import { ApprovalsPage } from "@/pages/admin/approvals/ApprovalsPage";
import { AmenityQueue } from "@/pages/admin/AmenityQueue";
import { Moderation } from "@/pages/admin/Moderation";
import { VenueForm } from "@/pages/admin/VenueForm";
import { Venues } from "@/pages/admin/Venues";
import { Analytics } from "@/pages/venue/Analytics";
import { EventsEditor } from "@/pages/venue/EventsEditor";
import { ListingEditor } from "@/pages/venue/ListingEditor";
import { Reviews } from "@/pages/venue/Reviews";
import { VenueDashboard } from "@/pages/venue/VenueDashboard";
import { VenueLayout } from "@/pages/venue/VenueLayout";
import { VenuesPage } from "@/pages/venue/VenuesPage";

// Owner and admin app (PRD 4.4, 4.5). Access is enforced by Supabase RLS, not
// by these routes (PRD 5.3); the guards only send people to the right place.

const ADMIN_NAV = [
  { to: "/admin/approvals", label: "Owner approvals" },
  { to: "/admin/venues", label: "Venues" },
  { to: "/admin/amenities", label: "Amenity changes" },
  { to: "/admin/reviews", label: "Reviews" },
];

function Centered({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center p-6 text-center">{children}</div>;
}

function Shell() {
  const { access, signOut, session } = useAuth();
  const name = (session?.user.user_metadata?.full_name as string | undefined) ?? session?.user.email ?? "";
  const owned = access?.claims.filter((claim) => claim.status === "approved" && claim.venueId) ?? [];
  const ownerHome = owned.length === 1 ? `/venue/${owned[0]!.venueId}` : "/venues";
  const links = [
    ...(owned.length ? [{ to: ownerHome, label: owned.length === 1 ? "My cafe" : "My cafes" }] : []),
    { to: "/status", label: "My claims" },
    { to: "/claim", label: "Claim a cafe" },
    ...(access?.isAdmin ? ADMIN_NAV : []),
  ];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap font-display text-2xl font-bold" aria-label="Visita for cafes home">
            Visita <span className="font-sans text-xs font-medium text-muted-foreground">for cafes</span>
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden max-w-56 truncate text-muted-foreground md:inline" title={name}>{name}</span>
            <Button variant="ghost" size="sm" onClick={() => void signOut()} aria-label="Sign out">
              <LogOut aria-hidden="true" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <nav aria-label="Workspace" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 pb-16 sm:px-6 sm:py-10">
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
            <Route path="admin/venues" element={<RequireAdmin><Venues /></RequireAdmin>} />
            <Route path="admin/venues/new" element={<RequireAdmin><VenueForm /></RequireAdmin>} />
            <Route path="admin/venues/:venueId" element={<RequireAdmin><VenueForm /></RequireAdmin>} />
            <Route path="admin/amenities" element={<RequireAdmin><AmenityQueue /></RequireAdmin>} />
            <Route path="admin/reviews" element={<RequireAdmin><Moderation /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" />
    </AuthProvider>
  );
}

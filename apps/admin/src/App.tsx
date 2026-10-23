import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { Menu } from "lucide-react";
import { Button } from "@visita/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@visita/ui/sheet";
import { Toaster } from "@visita/ui/sonner";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { SignIn } from "@/auth/SignIn";
import { homeFor } from "@/routes/home";
import { Sidebar } from "@/shell/Sidebar";
import { ClaimPage } from "@/pages/claim/ClaimPage";
import { StatusPage } from "@/pages/pending/StatusPage";
import { ApprovalsPage } from "@/pages/admin/approvals/ApprovalsPage";
import { AmenityQueue } from "@/pages/admin/AmenityQueue";
import { AmenityReports } from "@/pages/admin/AmenityReports";
import { DemandQueue } from "@/pages/admin/DemandQueue";
import { BillingList } from "@/pages/admin/billing/BillingList";
import { VenueBilling } from "@/pages/admin/billing/VenueBilling";
import { Moderation } from "@/pages/admin/Moderation";
import { VenueForm } from "@/pages/admin/VenueForm";
import { ScanWorkspace } from "@/pages/admin/ScanWorkspace";
import { Venues } from "@/pages/admin/Venues";
import { Analytics } from "@/pages/venue/Analytics";
import { Billing } from "@/pages/venue/Billing";
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

// A sidebar on wide screens; on phones a slim top bar opens the same sidebar
// in a sheet, which closes once a page is picked.
function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh p-3 pr-0 lg:block">
        <div className="h-full rounded-card bg-card shadow-card">
          <Sidebar />
        </div>
      </aside>

      <header className="sticky top-0 z-40 px-3 lg:hidden" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
        <div className="glass flex h-14 items-center gap-2 rounded-full pr-5 pl-2">
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
            <Menu aria-hidden="true" />
          </Button>
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap font-display text-xl font-bold" aria-label="Visita for cafes home">
            Visita <span className="font-sans text-xs font-medium text-muted-foreground">for cafes</span>
          </Link>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[min(18rem,85vw)] gap-0 rounded-r-[var(--radius-card)] border-0 bg-card p-0" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Pages in your workspace</SheetDescription>
          <Sidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="mx-auto w-full min-w-0 max-w-[112rem] px-4 py-6 pb-16 sm:px-6 lg:px-8 lg:py-8">
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
              <Route path="billing" element={<Billing />} />
            </Route>
            <Route path="admin/approvals" element={<RequireAdmin><ApprovalsPage /></RequireAdmin>} />
            <Route path="admin/venues" element={<RequireAdmin><Venues /></RequireAdmin>} />
            <Route path="admin/venues/new" element={<RequireAdmin><VenueForm /></RequireAdmin>} />
            <Route path="admin/venues/:venueId" element={<RequireAdmin><VenueForm /></RequireAdmin>} />
            <Route path="admin/venues/:venueId/scan" element={<RequireAdmin><ScanWorkspace /></RequireAdmin>} />
            <Route path="admin/demand" element={<RequireAdmin><DemandQueue /></RequireAdmin>} />
            <Route path="admin/billing" element={<RequireAdmin><BillingList /></RequireAdmin>} />
            <Route path="admin/billing/:venueId" element={<RequireAdmin><VenueBilling /></RequireAdmin>} />
            <Route path="admin/amenities" element={<RequireAdmin><AmenityQueue /></RequireAdmin>} />
            <Route path="admin/amenity-reports" element={<RequireAdmin><AmenityReports /></RequireAdmin>} />
            <Route path="admin/reviews" element={<RequireAdmin><Moderation /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" />
    </AuthProvider>
  );
}

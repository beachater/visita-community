import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { ArrowLeftRight, Box, ExternalLink, LogOut } from "lucide-react";
import { cn } from "@visita/ui/utils";
import { useAuth } from "@/auth/AuthProvider";
import { CONSUMER_URL, supabase } from "@/lib/supabase";
import { navFor, venueIdFrom, venuePages, workspaceFor, type NavItem } from "@/routes/nav";
import { AdminSidebar } from "./AdminSidebar";
import { NAV_ICONS } from "./icons";

// Two workspaces in one app (approved 2026-11-14). Admins in the admin pages
// get the navy admin console; everything else is the cafe workspace: light,
// with the cafe itself as the identity at the top. An admin in the cafe
// workspace is previewing it and gets a way back.

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { access } = useAuth();
  const { pathname } = useLocation();
  return workspaceFor(access?.isAdmin ?? false, pathname) === "admin" ? <AdminSidebar onNavigate={onNavigate} /> : <CafeSidebar onNavigate={onNavigate} />;
}

const row = "flex min-h-10.5 items-center gap-3 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

function Item({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = NAV_ICONS[item.icon];
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) => cn(row, isActive ? "bg-accent font-bold text-foreground" : "text-foreground hover:bg-muted")}
      >
        {({ isActive }) => (
          <>
            <Icon className={cn("size-4.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

/** The cafe on screen: its name and whether it's scanned (owners from their claims, admins by lookup). */
function useCafe(venueId: string | null) {
  const { access } = useAuth();
  const claim = access?.claims.find((c) => c.venueId === venueId && c.status === "approved");
  const [looked, setLooked] = useState<{ id: string; name: string; slug: string; scanned: boolean } | null>(null);
  useEffect(() => {
    if (!venueId) return;
    let live = true;
    supabase.from("venues").select("id, name, slug, splat_url").eq("id", venueId).maybeSingle().then(({ data }) => {
      if (live && data) setLooked({ id: data.id, name: data.name, slug: data.slug, scanned: Boolean(data.splat_url) });
    });
    return () => { live = false; };
  }, [venueId]);
  if (!venueId) return null;
  return {
    name: claim?.venueName ?? (looked?.id === venueId ? looked.name : "Your cafe"),
    slug: claim?.venueSlug ?? (looked?.id === venueId ? looked.slug : null),
    scanned: looked?.id === venueId ? looked.scanned : false,
    owned: Boolean(claim),
  };
}

function CafeSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { access, session, signOut } = useAuth();
  const { pathname } = useLocation();
  const isAdmin = access?.isAdmin ?? false;
  const venueId = venueIdFrom(pathname);
  const cafe = useCafe(venueId);
  const groups = navFor({ isAdmin: false, claims: access?.claims ?? [] }, pathname);
  const ownedCount = (access?.claims ?? []).filter((c) => c.status === "approved" && c.venueId).length;
  const name = (session?.user.user_metadata?.full_name as string | undefined) ?? session?.user.email ?? "";
  const email = session?.user.email ?? "";

  // On a cafe: that cafe's pages. Elsewhere: the owned cafes and claims, as before.
  const pages = venueId ? venuePages(`/venue/${venueId}`) : null;
  const claims = groups.find((g) => g.label === "Claims");
  const cafes = groups.find((g) => g.label !== "Claims");

  return (
    <div className="flex h-full flex-col gap-4 rounded-card bg-card p-3.5 shadow-card">
      <Link to="/" onClick={onNavigate} className="flex min-h-11 items-center gap-2 px-1.5" aria-label="Visita for cafes home">
        <img src="/brand/visita-logo.svg" alt="Visita" className="h-6 w-auto" />
        <span className="text-xs font-semibold text-muted-foreground">for cafes</span>
      </Link>

      {isAdmin && (
        <Link to="/admin/approvals" onClick={onNavigate} className="flex h-10 items-center justify-center gap-2 rounded-full bg-scan text-sm font-semibold text-white hover:bg-scan/90">
          <ArrowLeftRight className="size-4" aria-hidden="true" /> Back to admin
        </Link>
      )}

      {cafe && (
        <div className="flex items-center gap-3 rounded-[1.25rem] bg-muted p-3">
          <span className={cn("grid size-11.5 shrink-0 place-items-center rounded-[0.875rem]", cafe.scanned ? "bg-scan" : "bg-accent")} aria-hidden="true">
            <Box className={cn("size-5.5", cafe.scanned ? "text-gold" : "text-primary")} strokeWidth={1.6} />
          </span>
          <span className="grid min-w-0 gap-0.5">
            <strong className="text-sm leading-snug">{cafe.name}</strong>
            <span className="text-xs text-muted-foreground">{cafe.owned ? "You're the owner" : "Owner view (preview)"}</span>
          </span>
        </div>
      )}

      <nav aria-label="Your cafe" className="scroll-soft -mx-1 grid flex-1 content-start gap-5 overflow-y-auto px-1">
        {pages ? (
          <ul className="grid gap-0.5">{pages.map((item) => <Item key={item.to} item={item} onNavigate={onNavigate} />)}</ul>
        ) : (
          cafes && (
            <section className="grid gap-1">
              <h2 className="px-3.5 text-xs font-medium text-muted-foreground">{cafes.label}</h2>
              <ul className="grid gap-0.5">{cafes.items.map((item) => <Item key={item.to} item={{ ...item, children: undefined }} onNavigate={onNavigate} />)}</ul>
            </section>
          )
        )}
        {pages && ownedCount > 1 && (
          <Link to="/venues" onClick={onNavigate} className="px-3.5 text-sm font-semibold text-primary hover:underline">Switch cafe</Link>
        )}
        {claims && !(pages && cafe?.owned === false) && (
          <section className="grid gap-1">
            <h2 className="px-3.5 text-xs font-medium text-muted-foreground">Claims</h2>
            <ul className="grid gap-0.5">{claims.items.map((item) => <Item key={item.to} item={item} onNavigate={onNavigate} />)}</ul>
          </section>
        )}
      </nav>

      <div className="grid gap-2">
        {cafe?.slug && (
          <a href={`${CONSUMER_URL}/cafe/${cafe.slug}`} target="_blank" rel="noopener" className="flex min-h-10 items-center gap-2 px-3.5 text-sm font-semibold text-primary hover:underline">
            <ExternalLink className="size-4" aria-hidden="true" /> {cafe.owned ? "See your public page" : "See the public page"}
          </a>
        )}
        <div className="flex items-center gap-3 border-t border-accent pt-3 pl-1.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mist text-sm font-semibold text-foreground" aria-hidden="true">
            {(name || "?").charAt(0).toUpperCase()}
          </span>
          <span className="grid min-w-0 flex-1 text-sm leading-tight">
            <span className="truncate font-medium" title={name}>{name}</span>
            {email && email !== name && <span className="truncate text-xs text-muted-foreground" title={email}>{email}</span>}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

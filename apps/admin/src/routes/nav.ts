// The sidebar's contents for whoever is signed in. Plain data so it can be
// tested; the Sidebar maps each icon name to its glyph. Add a page by adding
// an item here. Like homeFor, this is only for getting around: RLS decides
// what each person can read or change.

import type { ClaimSummary } from "./home";

export type NavIcon =
  | "cafe" | "overview" | "listing" | "events" | "reviews" | "analytics"
  | "claims" | "claim" | "approvals" | "venues" | "demand" | "amenities" | "moderation";

export interface NavItem {
  to: string;
  label: string;
  icon: NavIcon;
  /** Active only on this exact path, not the pages under it. */
  end?: boolean;
  children?: NavItem[];
  /** Whether a parent's children are shown. */
  expanded?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface NavClaim extends ClaimSummary {
  venueName: string | null;
  proposedName: string | null;
}

const venuePages = (base: string): NavItem[] => [
  { to: base, label: "Overview", icon: "overview", end: true },
  { to: `${base}/listing`, label: "Listing", icon: "listing" },
  { to: `${base}/events`, label: "Events", icon: "events" },
  { to: `${base}/reviews`, label: "Reviews", icon: "reviews" },
  { to: `${base}/analytics`, label: "Analytics", icon: "analytics" },
];

const ADMIN: NavItem[] = [
  { to: "/admin/approvals", label: "Owner approvals", icon: "approvals" },
  { to: "/admin/venues", label: "Venues", icon: "venues" },
  { to: "/admin/demand", label: "Demand queue", icon: "demand" },
  { to: "/admin/amenities", label: "Amenity changes", icon: "amenities" },
  { to: "/admin/reviews", label: "Reviews", icon: "moderation" },
];

export function navFor({ isAdmin, claims }: { isAdmin: boolean; claims: NavClaim[] }, pathname: string): NavGroup[] {
  const owned = claims.filter((c) => c.status === "approved" && c.venueId);
  const groups: NavGroup[] = [];
  if (owned.length) {
    groups.push({
      label: owned.length === 1 ? "Your cafe" : "Your cafes",
      items: owned.map((c) => {
        const base = `/venue/${c.venueId}`;
        const here = pathname === base || pathname.startsWith(`${base}/`);
        return { to: base, label: c.venueName ?? c.proposedName ?? "Your cafe", icon: "cafe", children: venuePages(base), expanded: owned.length === 1 || here };
      }),
    });
  }
  groups.push({
    label: "Claims",
    items: [
      { to: "/status", label: "My claims", icon: "claims" },
      { to: "/claim", label: "Claim a cafe", icon: "claim" },
    ],
  });
  if (isAdmin) groups.push({ label: "Admin", items: ADMIN });
  return groups;
}

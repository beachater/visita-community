import { NavLink } from "react-router";
import { cn } from "@visita/ui/utils";
import { NAV_ICONS } from "./icons";
import { venuePages } from "@/routes/nav";

// Owners live on their phones (approved owner workspace, 2026-11-14): on a
// cafe's pages the main tabs sit in a bar at the bottom, by the thumb. The
// rest (Events, Billing) stay in the menu. Computers use the sidebar.

const TABS = new Set(["Overview", "Listing", "Reviews", "Analytics"]);

export function CafeTabBar({ venueId }: { venueId: string }) {
  const tabs = venuePages(`/venue/${venueId}`).filter((t) => TABS.has(t.label));
  return (
    <nav
      aria-label="Your cafe"
      className="glass fixed inset-x-3 z-40 grid h-17 grid-cols-4 items-center rounded-full px-1.5 lg:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
    >
      {tabs.map((t) => {
        const Icon = NAV_ICONS[t.icon];
        return (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => cn("grid h-14 place-items-center content-center gap-0.5 rounded-full text-[0.7rem] font-semibold", isActive ? "text-primary" : "text-muted-foreground")}
          >
            <Icon className="size-5" aria-hidden="true" />
            {t.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

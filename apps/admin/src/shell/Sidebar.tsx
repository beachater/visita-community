import { Link, NavLink, useLocation } from "react-router";
import {
  CalendarDays,
  ChartColumn,
  CirclePlus,
  ClipboardList,
  Eye,
  Coffee,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquare,
  MessageSquareWarning,
  ShieldCheck,
  Store,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@visita/ui/utils";
import { useAuth } from "@/auth/AuthProvider";
import { navFor, type NavIcon, type NavItem } from "@/routes/nav";

// The workspace sidebar: fixed on wide screens, inside a sheet on phones
// (see Shell). What it lists comes from navFor.

const ICONS: Record<NavIcon, LucideIcon> = {
  cafe: Coffee,
  overview: LayoutDashboard,
  listing: FileText,
  events: CalendarDays,
  reviews: MessageSquare,
  analytics: ChartColumn,
  claims: ClipboardList,
  claim: CirclePlus,
  approvals: ShieldCheck,
  venues: Store,
  demand: Eye,
  amenities: ListChecks,
  moderation: MessageSquareWarning,
};

const row = "flex min-h-10 items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

function Item({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = ICONS[item.icon];
  if (item.children) {
    return (
      <li className="grid gap-0.5">
        <NavLink
          to={item.to}
          end
          onClick={onNavigate}
          className={({ isActive }) => cn(row, isActive || item.expanded ? "text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.label}</span>
        </NavLink>
        {item.expanded && (
          <ul className="ml-5 grid gap-0.5 border-l border-mist pl-2">
            {item.children.map((child) => (
              <Item key={child.to} item={child} onNavigate={onNavigate} />
            ))}
          </ul>
        )}
      </li>
    );
  }
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) => cn(row, isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.label}</span>
      </NavLink>
    </li>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { access, session, signOut } = useAuth();
  const { pathname } = useLocation();
  const groups = navFor(access ?? { isAdmin: false, claims: [] }, pathname);
  const name = (session?.user.user_metadata?.full_name as string | undefined) ?? session?.user.email ?? "";
  const email = session?.user.email ?? "";

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/" onClick={onNavigate} className="inline-flex min-h-11 items-center gap-2 px-2 font-display text-2xl font-bold" aria-label="Visita for cafes home">
        Visita <span className="font-sans text-xs font-medium text-muted-foreground">for cafes</span>
      </Link>

      <nav aria-label="Workspace" className="-mx-1 grid flex-1 content-start gap-6 overflow-y-auto px-1">
        {groups.map((group) => (
          <section key={group.label} className="grid gap-1" aria-labelledby={`nav-${group.label}`}>
            <h2 id={`nav-${group.label}`} className="px-3 text-xs font-medium text-muted-foreground">
              {group.label}
            </h2>
            <ul className="grid gap-0.5">
              {group.items.map((item) => (
                <Item key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="flex items-center gap-3 rounded-2xl bg-accent/60 p-2 pl-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-medium text-primary-foreground" aria-hidden="true">
          {(name || "?").charAt(0).toUpperCase()}
        </span>
        <span className="grid min-w-0 flex-1 text-sm leading-tight">
          <span className="truncate font-medium" title={name}>{name}</span>
          {email && email !== name && <span className="truncate text-xs text-muted-foreground" title={email}>{email}</span>}
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import { LogOut } from "lucide-react";
import { cn } from "@visita/ui/utils";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { ADMIN_GROUPS, type QueueKey } from "@/routes/nav";
import { CafeViewPicker } from "./CafeViewPicker";
import { NAV_ICONS } from "./icons";

// The admin console's sidebar (approved owner/admin workspaces, 2026-11-14):
// Deep Navy so it never looks like an owner's space, labelled "Admin
// console", pages grouped as Queues, Catalog and System with waiting counts,
// and an "Admin / Cafe view" switch that's always in reach.

async function queueCounts(): Promise<Partial<Record<QueueKey, number>>> {
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [approvals, amenities, reports] = await Promise.all([
    count(supabase.from("venue_owners").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(supabase.from("amenity_change_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(supabase.from("amenity_reports").select("id", { count: "exact", head: true }).eq("status", "open").eq("verdict", "dispute")),
  ]);
  return { approvals, amenities, reports };
}

const row = "flex min-h-10 items-center gap-3 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mist";

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { session, signOut } = useAuth();
  const [counts, setCounts] = useState<Partial<Record<QueueKey, number>>>({});
  const [picking, setPicking] = useState(false);
  const name = (session?.user.user_metadata?.full_name as string | undefined) ?? session?.user.email ?? "";

  useEffect(() => {
    let live = true;
    const refresh = () => queueCounts().then((c) => live && setCounts(c)).catch(() => undefined);
    void refresh();
    // Counts change as other admins work; a light refresh keeps them honest.
    const t = window.setInterval(refresh, 60_000);
    return () => { live = false; window.clearInterval(t); };
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 rounded-card bg-scan p-3 text-white shadow-card">
      <Link to="/admin/approvals" onClick={onNavigate} className="flex min-h-11 items-center gap-2.5 px-2" aria-label="Visita admin console">
        <span className="grid size-9 place-items-center rounded-[0.625rem] bg-[#004aad]"><img src="/brand/visita-mark.svg" alt="" className="w-5" /></span>
        <span className="grid leading-tight">
          <span className="font-display text-base text-white">Visita</span>
          <span className="text-[0.625rem] font-bold tracking-[0.14em] text-[#7fa6cc]">ADMIN CONSOLE</span>
        </span>
      </Link>

      <div role="group" aria-label="Workspace" className="mx-0.5 grid grid-cols-2 rounded-full bg-white/10 p-1">
        <span aria-current="true" className="grid h-8.5 place-items-center rounded-full bg-card text-[0.8rem] font-semibold text-foreground">Admin</span>
        <button type="button" onClick={() => setPicking(true)} className="h-8.5 rounded-full text-[0.8rem] font-semibold text-mist hover:text-white">
          Cafe view
        </button>
      </div>

      <nav aria-label="Admin" className="scroll-soft -mx-1 grid flex-1 content-start gap-4 overflow-y-auto px-1">
        {ADMIN_GROUPS.map((group) => (
          <section key={group.label} className="grid gap-0.5" aria-labelledby={`admin-nav-${group.label}`}>
            <h2 id={`admin-nav-${group.label}`} className="px-3.5 pb-1 text-[0.625rem] font-bold tracking-[0.14em] text-[#7fa6cc] uppercase">{group.label}</h2>
            <ul className="grid gap-0.5">
              {group.items.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                const n = item.queue ? counts[item.queue] : undefined;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) => cn(row, isActive ? "bg-white/12 font-bold text-white" : "text-mist hover:bg-white/8 hover:text-white")}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {n ? <span className="grid h-5.5 min-w-5.5 place-items-center rounded-full bg-cloud px-1.5 text-[0.7rem] font-bold text-navy" aria-label={`${n} waiting`}>{n}</span> : null}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-mist/20 px-1.5 pt-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold" aria-hidden="true">{(name || "?").charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-cloud" title={name}>{name}</span>
        <span className="rounded-full bg-white/12 px-2 py-0.5 text-[0.625rem] font-bold text-cloud">Admin</span>
        <button type="button" onClick={() => void signOut()} className="grid size-9 shrink-0 place-items-center rounded-full text-mist hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </div>

      <CafeViewPicker open={picking} onOpenChange={setPicking} onPicked={onNavigate} />
    </div>
  );
}

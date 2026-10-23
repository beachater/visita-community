import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@visita/ui/button";
import { supabase } from "@/lib/supabase";
import { ScanUpload } from "./ScanUpload";

export function ScanWorkspace() {
  const { venueId = "" } = useParams();
  const [venue, setVenue] = useState<{ id: string; name: string; is_published: boolean; splat_url: string | null; scanned_at: string | null } | null | undefined>(undefined);

  const load = useCallback(async () => {
    const { data } = await supabase.from("venues").select("id,name,is_published,splat_url,scanned_at").eq("id", venueId).maybeSingle();
    setVenue(data);
  }, [venueId]);
  useEffect(() => {
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  return <div className="grid min-w-0 gap-5">
    <Link to={`/admin/venues/${venueId}`} className="inline-flex w-fit items-center gap-1 text-sm underline-offset-2 hover:underline"><ArrowLeft className="size-4" /> Venue details</Link>
    {venue === undefined ? <p className="text-muted-foreground">Loading cafe…</p> : venue === null ? <p role="alert">Cafe not found.</p> : <>
      <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-3xl font-bold">{venue.name} · 3D scan</h1><p className="text-sm text-muted-foreground">Set up and preview a draft here. A published scan appears to visitors when the cafe listing is also published.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw /> Refresh status</Button></header>
      <ScanUpload venue={venue} onDone={() => void load()} />
    </>}
  </div>;
}

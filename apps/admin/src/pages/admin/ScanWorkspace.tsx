import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ScanUpload } from "./ScanUpload";

export function ScanWorkspace() {
  const { venueId = "" } = useParams();
  const [venue, setVenue] = useState<{ id: string; name: string; is_published: boolean; splat_url: string | null; scanned_at: string | null } | null | undefined>(undefined);

  const load = useCallback(async () => {
    const { data } = await supabase.from("venues").select("id,name,is_published,splat_url,scanned_at").eq("id", venueId).maybeSingle();
    setVenue(data);
  }, [venueId]);
  useEffect(() => { void load(); }, [load]);

  return <div className="grid min-w-0 gap-5">
    <Link to={`/admin/venues/${venueId}`} className="inline-flex w-fit items-center gap-1 text-sm underline-offset-2 hover:underline"><ArrowLeft className="size-4" /> Venue details</Link>
    {venue === undefined ? <p className="text-muted-foreground">Loading cafe…</p> : venue === null ? <p role="alert">Cafe not found.</p> : <>
      <header><h1 className="font-display text-3xl font-bold">{venue.name} · 3D scan</h1><p className="text-sm text-muted-foreground">Set up and preview a draft here. A published scan appears to visitors when the cafe listing is also published.</p></header>
      <ScanUpload venue={venue} onDone={() => void load()} />
    </>}
  </div>;
}

import type { OccupancyRow } from "@visita/shared-types";

// Live occupancy (PRD 4.4) on the cafe page and walkthrough, via Supabase
// Realtime. The client library loads only when a pill is on screen, and RLS
// means expired or unpublished rows never arrive.

export async function watchOccupancy(venueId: string, onChange: (row: OccupancyRow | null) => void): Promise<() => void> {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return () => {};

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data } = await client.from("venue_occupancy").select("level, set_at, expires_at").eq("venue_id", venueId).maybeSingle();
  onChange((data as OccupancyRow | null) ?? null);

  const channel = client
    .channel(`occupancy:${venueId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "venue_occupancy", filter: `venue_id=eq.${venueId}` }, (payload) =>
      onChange(payload.eventType === "DELETE" ? null : (payload.new as OccupancyRow)),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

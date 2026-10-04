import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@visita/ui/utils";
import { readPublic } from "@/lib/public-data";
import { eventRange, upcomingEventsPath, type VenueEvent } from "@/lib/venue/events";

// Current and upcoming events (PRD 4.4), fetched fresh so the cached cafe
// page and the walkthrough show what the owner posted today. Renders nothing
// when there are none.

export function EventList({ venueId, tone = "light", heading = true }: { venueId: string; tone?: "light" | "glass"; heading?: boolean }) {
  const [events, setEvents] = useState<VenueEvent[]>([]);

  useEffect(() => {
    let live = true;
    readPublic<VenueEvent>(upcomingEventsPath(venueId, new Date()))
      .then((e) => live && setEvents(e))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [venueId]);

  if (events.length === 0) return null;
  const now = Date.now();
  return (
    <section aria-label="Events" className="grid gap-2">
      {heading && <h2 className={cn(tone === "glass" ? "text-xs font-bold uppercase tracking-wider opacity-70" : "font-display text-2xl font-semibold")}>Events</h2>}
      <ul className="grid gap-2">
        {events.map((e) => (
          <li key={e.id} className={cn("flex gap-3 rounded-2xl p-3", tone === "glass" ? "bg-white/10" : "bg-card shadow-card")}>
            {e.photo_url ? (
              <img src={`/assets/${e.photo_url}`} alt="" className="size-16 shrink-0 rounded-xl object-cover" loading="lazy" />
            ) : (
              <CalendarDays className="mt-0.5 size-5 shrink-0 opacity-70" aria-hidden="true" />
            )}
            <div className="min-w-0 text-sm">
              {new Date(e.starts_at).getTime() <= now && <p className="text-xs font-bold uppercase tracking-wide text-success">Happening now</p>}
              <p className="font-medium">{e.title}</p>
              <p className="opacity-80">{eventRange(e.starts_at, e.ends_at)}</p>
              {e.description && <p className="mt-1 whitespace-pre-line">{e.description}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

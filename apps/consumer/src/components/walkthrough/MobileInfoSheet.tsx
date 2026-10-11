import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, LocateFixed, MessageSquare, Navigation } from "lucide-react";
import type { AmenityDefinition } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { cn } from "@visita/ui/utils";
import { amenityRows, summaryRows } from "@/lib/venue/amenities";
import { isOpenAt, venueClock, weeklyRows } from "@/lib/venue/hours";
import { formatPhp, scanDate } from "@/lib/venue/scan";
import type { WalkthroughCafe } from "@/lib/venue/types";
import { openReviewSheet } from "@/lib/reviews/open";
import { AmenityList } from "../venue/AmenityList";
import { EventList } from "../venue/EventList";
import { OccupancyPill } from "../venue/OccupancyPill";

interface Props {
  cafe: WalkthroughCafe;
  definitions: AmenityDefinition[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distance: string | null;
  onRequestDistance: (() => void) | null;
  onDirections: () => void;
  onOpenMenu: () => void;
}

export function MobileInfoSheet({ cafe, definitions, open, onOpenChange, distance, onRequestDistance, onDirections, onOpenMenu }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const strip = useMemo(() => summaryRows(definitions, cafe.amenities), [definitions, cafe.amenities]);
  const cards = useMemo(() => amenityRows(definitions, cafe.amenities), [definitions, cafe.amenities]);
  const hours = cafe.hours ? weeklyRows(cafe.hours) : [];
  const today = venueClock(now).day;
  const venueOpen = isOpenAt(cafe.hours, now);
  const scan = scanDate(cafe.scannedAt, now);

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={cafe.name} description={`About ${cafe.name}`} className="md:hidden">
      <div className="grid gap-5 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-verified px-2 py-1 font-bold text-verified-foreground">
            <BadgeCheck className="size-3" aria-hidden="true" /> Scanned
          </span>
          {venueOpen !== null && <span className="rounded-full border px-2 py-1">{venueOpen ? "Open now" : "Closed"}</span>}
          <OccupancyPill venueId={cafe.id} />
          {scan && <span className={cn("rounded-full border px-2 py-1", scan.stale && "text-muted-foreground")}>{scan.label}{scan.stale && " · the room may have changed"}</span>}
        </div>

        {strip.length > 0 && (
          <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/60 p-3">
            {strip.map((row) => (
              <div key={row.key} className="min-w-0">
                <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{row.label}</dt>
                <dd className="truncate text-sm font-semibold" title={row.text}>{row.short}</dd>
              </div>
            ))}
          </dl>
        )}

        <section aria-label="Location" className="grid gap-2">
          {cafe.address && <p className="text-sm">{cafe.address}</p>}
          {distance ? <p className="text-sm text-muted-foreground">{distance}</p> : onRequestDistance && (
            <button type="button" onClick={onRequestDistance} className="inline-flex min-h-11 w-fit items-center gap-2 text-sm underline underline-offset-2">
              <LocateFixed className="size-4" aria-hidden="true" /> Show distance
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button className="min-h-11" onClick={onDirections}><Navigation /> Directions</Button>
            <Button className="min-h-11" variant="secondary" onClick={() => { onOpenChange(false); openReviewSheet(cafe.slug); }}><MessageSquare /> Reviews</Button>
          </div>
        </section>

        <EventList venueId={cafe.id} />

        {cards.length > 0 && (
          <section aria-label="Amenities">
            <h3 className="mb-2 font-display text-lg font-semibold">Amenities</h3>
            <AmenityList rows={cards} venueId={cafe.id} slug={cafe.slug} returnToWalkthrough />
          </section>
        )}

        {hours.length > 0 && (
          <section aria-label="Opening hours">
            <h3 className="mb-2 font-display text-lg font-semibold">Opening hours</h3>
            <dl className="grid gap-1 text-sm">
              {hours.map((row) => (
                <div key={row.day} className={cn("grid grid-cols-[7rem_1fr] gap-3", row.day === today && "font-bold")}>
                  <dt className={row.day === today ? "" : "text-muted-foreground"}>{row.label}{row.day === today && <span className="sr-only"> (today)</span>}</dt>
                  <dd>{row.text ?? "Not known"}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {cafe.menu.length > 0 && (
          <section aria-label="Menu">
            <h3 className="mb-2 font-display text-lg font-semibold">Menu</h3>
            <ul className="grid gap-2 text-sm">
              {cafe.menu.slice(0, 4).map((item, index) => (
                <li key={index} className="flex justify-between gap-3"><span>{item.name}</span>{item.price_php !== undefined && <span className="shrink-0 tabular-nums">{formatPhp(item.price_php)}</span>}</li>
              ))}
            </ul>
            {cafe.menu.length > 4 && <Button variant="secondary" className="mt-3 min-h-11 w-full" onClick={onOpenMenu}>See full menu ({cafe.menu.length} items)</Button>}
          </section>
        )}
      </div>
    </BottomSheet>
  );
}

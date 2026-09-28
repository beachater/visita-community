import { useEffect, useId, useMemo, useState } from "react";
import { BadgeCheck, ChevronDown, LocateFixed, Navigation } from "lucide-react";
import type { AmenityDefinition } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { cn } from "@visita/ui/utils";
import { amenityRows, summaryRows } from "@/lib/venue/amenities";
import { isOpenAt, venueClock, weeklyRows } from "@/lib/venue/hours";
import { formatPhp, scanDate } from "@/lib/venue/scan";
import type { WalkthroughCafe } from "@/lib/venue/types";

// PRD 4.2 "Cafe info panel": one glass container on the left holding every
// known detail, collapsed to a three-stat strip by default. Unknown fields
// don't render.

interface Props {
  cafe: WalkthroughCafe;
  definitions: AmenityDefinition[];
  /** "1.2 km away", or null when location isn't known. */
  distance: string | null;
  onRequestDistance: (() => void) | null;
  onDirections: () => void;
  onOpenMenu: () => void;
}

const MENU_PREVIEW = 4;

export function InfoPanel({ cafe, definitions, distance, onRequestDistance, onDirections, onOpenMenu }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const bodyId = useId();

  // Open now is judged in Manila time and refreshed every minute.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const strip = useMemo(() => summaryRows(definitions, cafe.amenities), [definitions, cafe.amenities]);
  const cards = useMemo(() => amenityRows(definitions, cafe.amenities), [definitions, cafe.amenities]);
  const hours = cafe.hours ? weeklyRows(cafe.hours) : [];
  const today = venueClock(now).day;
  const open = isOpenAt(cafe.hours, now);
  const scan = scanDate(cafe.scannedAt, now);

  return (
    <aside
      aria-label={`About ${cafe.name}`}
      className="pointer-events-auto flex max-h-full flex-col overflow-hidden rounded-xl border border-glass-border bg-glass text-glass-foreground shadow-lg backdrop-blur-md"
    >
      {/* Always visible: identity, state, and the three-stat strip. */}
      <div className="grid gap-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-semibold leading-tight">{cafe.name}</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-1.5 -mt-1 shrink-0 text-glass-foreground hover:bg-white/10 hover:text-glass-foreground"
            aria-expanded={expanded}
            aria-controls={bodyId}
            aria-label={expanded ? "Show less" : "Show all details"}
            onClick={() => setExpanded((x) => !x)}
          >
            <ChevronDown className={cn("size-5 transition-transform", expanded && "rotate-180")} />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-verified px-2 py-0.5 font-bold text-verified-foreground">
            <BadgeCheck className="size-3" aria-hidden="true" />
            Scanned
          </span>
          {open !== null && (
            <span className={cn("rounded-full border px-2 py-0.5 font-medium", open ? "border-glass-positive/50 text-glass-positive" : "border-white/25 opacity-80")}>
              {open ? "Open now" : "Closed"}
            </span>
          )}
          {scan && (
            // PRD: the scan date is always in plain sight, muted past twelve months.
            <span className={cn("rounded-full border border-white/20 px-2 py-0.5", scan.stale && "opacity-60")}>
              {scan.label}
              {scan.stale && " · the room may have changed"}
            </span>
          )}
        </div>

        {strip.length > 0 && (
          <dl className="grid grid-cols-3 gap-2 border-t border-white/15 pt-2.5">
            {strip.map((row) => (
              <div key={row.key} className="min-w-0">
                <dt className="text-[0.7rem] uppercase tracking-wide opacity-70">{row.label}</dt>
                <dd className="truncate text-sm font-medium" title={row.text}>{row.short}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Everything else we know. */}
      <div id={bodyId} hidden={!expanded} className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-white/15">
        <div className="grid gap-5 p-4">
          <section className="grid gap-2" aria-label="Location">
            {cafe.address && <p className="text-sm">{cafe.address}</p>}
            {distance ? (
              <p className="text-sm opacity-80">{distance}</p>
            ) : (
              onRequestDistance && (
                <button type="button" onClick={onRequestDistance} className="inline-flex w-fit items-center gap-1.5 text-sm underline underline-offset-2 opacity-90 hover:opacity-100">
                  <LocateFixed className="size-4" aria-hidden="true" />
                  Show distance
                </button>
              )
            )}
            <Button onClick={onDirections} className="mt-1 w-full">
              <Navigation /> Get directions
            </Button>
          </section>

          {cards.length > 0 && (
            <section aria-label="Amenities">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider opacity-70">Amenities</h3>
              <dl className="grid gap-2">
                {cards.map((row) => (
                  <div key={row.key} className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
                    <dt className="opacity-70">{row.label}</dt>
                    <dd>{row.text}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {hours.length > 0 && (
            <section aria-label="Opening hours">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider opacity-70">Opening hours</h3>
              <dl className="grid gap-1 text-sm">
                {hours.map((row) => (
                  <div key={row.day} className={cn("grid grid-cols-[7rem_1fr] gap-3", row.day === today && "font-bold")}>
                    <dt className={row.day === today ? "" : "opacity-70"}>
                      {row.label}
                      {row.day === today && <span className="sr-only"> (today)</span>}
                    </dt>
                    <dd>{row.text ?? "Not known"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {cafe.menu.length > 0 && (
            <section aria-label="Menu">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider opacity-70">Menu</h3>
              <ul className="grid gap-1.5 text-sm">
                {cafe.menu.slice(0, MENU_PREVIEW).map((item, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{item.name}</span>
                    {item.price_php !== undefined && <span className="tabular-nums">{formatPhp(item.price_php)}</span>}
                  </li>
                ))}
              </ul>
              {cafe.menu.length > MENU_PREVIEW && (
                <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={onOpenMenu}>
                  See full menu ({cafe.menu.length} items)
                </Button>
              )}
            </section>
          )}
        </div>
      </div>
    </aside>
  );
}

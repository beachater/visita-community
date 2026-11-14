import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeCheck, LocateFixed, MessageSquare, Navigation, X } from "lucide-react";
import type { AmenityDefinition, MenuItem, VenueAmenities, WeeklyHours } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { cn } from "@visita/ui/utils";
import { amenityRows } from "@/lib/venue/amenities";
import { todaySummary, venueClock, weeklyRows } from "@/lib/venue/hours";
import { formatPhp, scanDate } from "@/lib/venue/scan";
import { AccuracyCheck } from "./AccuracyCheck";
import { EventList } from "./EventList";
import { OccupancyPill } from "./OccupancyPill";

// A cafe's details in the approved order (BEA-14 idea 3), shared by the
// walkthrough's desktop panel, the phone details sheet and the desktop map:
//   1. Is it open, and where is it?  name, labels, today's hours, address
//   2. What can I do?                the buttons, passed in by the caller
//   3. What's it like, and when?     key facts and the week's hours, then
//                                    one "Help keep this accurate" button
//   4. Events and a menu preview, when the cafe has them.
// The panel is a size container: from 25rem wide, facts and hours sit side
// by side and events and menu share a row; narrower (phones), everything
// stacks and facts read as label/value rows.

export interface DetailsCafe {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  scannedAt: string | null;
  amenities: VenueAmenities;
  hours: WeeklyHours | null;
  menu: MenuItem[];
  /** Map venues can be unscanned; walkthrough cafes always are scanned. */
  scanned?: boolean;
}

interface Props {
  cafe: DetailsCafe;
  definitions: AmenityDefinition[];
  tone: "dark" | "light";
  /** The phone sheet already titles itself with the name. */
  showName?: boolean;
  onClose?: () => void;
  distance: string | null;
  onRequestDistance: (() => void) | null;
  actions: ReactNode;
  onOpenMenu: () => void;
  /** Where sign-in returns to from "Help keep this accurate". */
  accuracyReturnPath: string;
}

const MENU_PREVIEW = 4;

const TONE = {
  dark: {
    muted: "opacity-70",
    line: "border-white/15",
    positive: "text-glass-positive",
    pill: "border-white/25",
    dashed: "border-white/25",
    item: "bg-white/10",
  },
  light: {
    muted: "text-muted-foreground",
    line: "border-border",
    positive: "text-success",
    pill: "border-border",
    dashed: "border-border",
    item: "bg-muted/60",
  },
} as const;

/** The clock the details read from, refreshed every minute. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function CafeDetails({ cafe, definitions, tone, showName = true, onClose, distance, onRequestDistance, actions, onOpenMenu, accuracyReturnPath }: Props) {
  const t = TONE[tone];
  const now = useMinuteClock();
  const facts = useMemo(() => amenityRows(definitions, cafe.amenities), [definitions, cafe.amenities]);
  const hours = cafe.hours ? weeklyRows(cafe.hours, true) : [];
  const today = venueClock(now).day;
  const summary = todaySummary(cafe.hours, now);
  const scan = scanDate(cafe.scannedAt, now);
  const scanned = cafe.scanned ?? true;
  const heading = cn("text-xs font-bold uppercase tracking-wider", t.muted);

  return (
    <div className="@container">
      {/* 1. Is it open, and where is it? */}
      <header className="grid gap-2 px-5 pt-5 pb-4">
        {showName && (
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl leading-tight">{cafe.name}</h2>
            {onClose && (
              <Button variant="ghost" size="icon-sm" className="-mr-2 -mt-1 shrink-0" aria-label="Close" onClick={onClose}>
                <X className="size-5" />
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {scanned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-verified px-2 py-0.5 font-bold text-verified-foreground">
              <BadgeCheck className="size-3" aria-hidden="true" /> Scanned
            </span>
          ) : (
            <span className={cn("rounded-full border px-2 py-0.5", t.pill, t.muted)}>Not scanned yet</span>
          )}
          {summary.open !== null && (
            <span className={cn("rounded-full border px-2 py-0.5 font-semibold", summary.open ? cn(t.positive, "border-current/40") : t.pill)}>
              {summary.open ? "Open now" : "Closed"}
            </span>
          )}
          <OccupancyPill venueId={cafe.id} tone={tone === "dark" ? "glass" : "light"} />
          {scanned && scan && (
            // PRD: the scan date is always in plain sight, muted past twelve months.
            <span className={cn("rounded-full border px-2 py-0.5", t.pill, scan.stale && "opacity-60")}>
              {scan.label}
              {scan.stale && " · the room may have changed"}
            </span>
          )}
        </div>
        <p className="text-sm">
          {summary.hours ? (
            <>
              Today <b className={t.positive}>{summary.hours}</b>
              {summary.note && ` · ${summary.note}`}
            </>
          ) : (
            summary.note
          )}
        </p>
        {(cafe.address || distance || onRequestDistance) && (
          <p className="text-sm">
            {cafe.address && <span className={t.muted}>{cafe.address}</span>}
            {cafe.address && (distance || onRequestDistance) && <span className={t.muted}> · </span>}
            {distance ? (
              <span className={t.muted}>{distance}</span>
            ) : (
              onRequestDistance && (
                <button type="button" onClick={onRequestDistance} className="inline-flex items-center gap-1 underline underline-offset-2 opacity-90 hover:opacity-100">
                  <LocateFixed className="size-3.5" aria-hidden="true" /> Show distance
                </button>
              )
            )}
          </p>
        )}
      </header>

      {/* 2. What can I do? */}
      <div className={cn("border-t px-5 py-4", t.line)}>{actions}</div>

      {/* 3. What's it like, and when is it open? Phones: facts, button, hours.
          Wide panels: facts | hours, with the button across both. */}
      <div className={cn("grid gap-4 border-t px-5 py-4 @min-[25rem]:grid-cols-2 @min-[25rem]:gap-x-0", t.line)}>
        <section aria-label="Key facts" className="grid content-start gap-2 @min-[25rem]:col-start-1 @min-[25rem]:row-start-1 @min-[25rem]:pr-5">
          <h3 className={heading}>Key facts</h3>
          {facts.length > 0 ? (
            <dl className="grid @min-[25rem]:gap-1.5">
              {facts.map((row) => (
                <div key={row.key} className={cn("flex justify-between gap-4 border-b py-1.5 text-sm last:border-0 @min-[25rem]:block @min-[25rem]:border-0 @min-[25rem]:py-0", t.line)}>
                  <dt className={cn("@min-[25rem]:text-xs", t.muted)}>{row.label}</dt>
                  <dd className="text-right font-semibold @min-[25rem]:text-left">{row.text}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className={cn("text-sm", t.muted)}>Not listed yet.</p>
          )}
        </section>

        {facts.length > 0 && (
          <AccuracyCheck
            rows={facts}
            venueId={cafe.id}
            returnPath={accuracyReturnPath}
            tone={tone}
            className="@min-[25rem]:col-span-2 @min-[25rem]:row-start-2 @min-[25rem]:mt-1"
          />
        )}

        <section
          aria-label="Opening hours"
          className={cn(
            "-mx-5 grid content-start gap-2 border-t px-5 pt-4 @min-[25rem]:col-start-2 @min-[25rem]:row-start-1 @min-[25rem]:mx-0 @min-[25rem]:border-t-0 @min-[25rem]:border-l @min-[25rem]:pt-0 @min-[25rem]:pr-0",
            t.line,
          )}
        >
          <h3 className={heading}>Opening hours</h3>
          {hours.length > 0 ? (
            <dl className="grid gap-1 text-sm">
              {hours.map((row) => (
                <div key={row.day} className={cn("grid grid-cols-[2.75rem_1fr] gap-2", row.day === today && "font-bold")}>
                  <dt className={row.day === today ? "" : t.muted}>
                    {row.label.slice(0, 3)}
                    {row.day === today && <span className="sr-only"> (today)</span>}
                  </dt>
                  <dd>{row.text ?? "Not listed"}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className={cn("text-sm", t.muted)}>Hours not listed yet.</p>
          )}
        </section>
      </div>

      {/* 4. Events and menu, only when the cafe has them. Side by side when wide. */}
      <div className={cn("flex flex-wrap gap-x-5 gap-y-4 border-t px-5 py-4 empty:hidden", t.line)}>
        <EventList
          venueId={cafe.id}
          className="min-w-0 flex-1 basis-44"
          headingClassName={heading}
          itemClassName={t.item}
        />
        {cafe.menu.length > 0 && (
          <section aria-label="Menu" className="grid min-w-0 flex-1 basis-44 content-start gap-2">
            <h3 className={heading}>Menu</h3>
            <ul className="grid gap-1.5 text-sm">
              {cafe.menu.slice(0, MENU_PREVIEW).map((item, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{item.name}</span>
                  {item.price_php !== undefined && <span className="shrink-0 tabular-nums">{formatPhp(item.price_php)}</span>}
                </li>
              ))}
            </ul>
            {cafe.menu.length > MENU_PREVIEW && (
              <Button variant="secondary" size="sm" className="mt-1 w-full" onClick={onOpenMenu}>
                See full menu ({cafe.menu.length} items)
              </Button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

interface ActionProps {
  /** Map: the big "Enter 3D walkthrough" (or "I want to see inside") button. */
  primary?: ReactNode;
  onDirections: (() => void) | null;
  onReviews: () => void;
  /** Bigger touch targets in the phone sheet. */
  touch?: boolean;
}

/** Section 2: Directions and Reviews, under a main button on the map. */
export function CafeActions({ primary, onDirections, onReviews, touch = false }: ActionProps) {
  const size = touch ? "min-h-11" : "";
  return (
    <div className="grid gap-2">
      {primary}
      <div className={cn("grid gap-2", onDirections && "grid-cols-2")}>
        {onDirections && (
          <Button className={size} variant={primary ? "outline" : "default"} onClick={onDirections}>
            <Navigation /> {primary || touch ? "Directions" : "Get directions"}
          </Button>
        )}
        <Button className={size} variant={primary ? "outline" : "secondary"} onClick={onReviews}>
          <MessageSquare /> Reviews
        </Button>
      </div>
    </div>
  );
}

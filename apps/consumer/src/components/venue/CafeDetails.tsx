import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "@nanostores/react";
import { Armchair, BadgeCheck, Car, CreditCard, Heart, Info, LocateFixed, MapPin, MessageSquare, Navigation, Plug, Snowflake, Users, UtensilsCrossed, Wifi, X, type LucideIcon } from "lucide-react";
import type { AmenityDefinition, MenuItem, VenueAmenities, WeeklyHours } from "@visita/shared-types";
import { amenityIcon } from "@visita/ui/amenity-icon";
import { Button } from "@visita/ui/button";
import { cn } from "@visita/ui/utils";
import { amenityRows } from "@/lib/venue/amenities";
import { todaySummary, venueClock, weeklyRows } from "@/lib/venue/hours";
import { formatPhp, scanDate } from "@/lib/venue/scan";
import { $saved, toggleSaved } from "@/lib/visitor/stores";
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
  const dark = tone === "dark";
  const now = useMinuteClock();
  const facts = useMemo(() => amenityRows(definitions, cafe.amenities), [definitions, cafe.amenities]);
  const hours = cafe.hours ? weeklyRows(cafe.hours, true) : [];
  const today = venueClock(now).day;
  const summary = todaySummary(cafe.hours, now);
  const scan = scanDate(cafe.scannedAt, now);
  const scanned = cafe.scanned ?? true;
  const sectionTitle = cn("font-display text-[1.0625rem] leading-tight", dark && "text-white");
  const pill = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold";
  // One line when every day shares the same hours; otherwise a row per day.
  const known = hours.filter((r) => r.text !== null);
  const sameEveryDay = known.length === 7 && known.every((r) => r.text === known[0]!.text) ? known[0]!.text : null;

  return (
    <div className="@container grid gap-5 px-5 pt-5 pb-5">
      {/* 1. Who, is it open, and where. */}
      <header className="grid gap-2">
        {showName && (
          <div className="flex items-start justify-between gap-3">
            <h2 className={cn("font-display text-[1.75rem] leading-[1.1]", dark && "text-white")}>{cafe.name}</h2>
            {onClose && (
              <Button variant="ghost" size="icon-sm" className={cn("-mr-1 shrink-0 rounded-full", dark ? "hover:bg-white/10" : "bg-muted")} aria-label="Close" onClick={onClose}>
                <X className="size-4" />
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {scanned ? (
            <span className={cn(pill, "bg-verified font-bold text-verified-foreground")}>
              <BadgeCheck className="size-3.5" aria-hidden="true" /> Scanned in 3D
            </span>
          ) : (
            <span className={cn(pill, "font-medium", dark ? "bg-white/10" : "bg-muted text-muted-foreground")}>Not scanned yet</span>
          )}
          {summary.open !== null && (
            <span className={cn(pill, summary.open ? (dark ? "bg-glass-positive/15 text-glass-positive" : "bg-success/10 text-success") : dark ? "bg-white/10" : "bg-muted text-muted-foreground")}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              {summary.open ? "Open now" : "Closed"}
            </span>
          )}
          <OccupancyPill venueId={cafe.id} tone={dark ? "glass" : "light"} />
          {scanned && scan && (
            // PRD: the scan date is always in plain sight, muted past twelve months.
            <span className={cn(pill, "font-medium", dark ? "bg-white/10" : "bg-accent text-primary", scan.stale && "opacity-60")}>
              {scan.label}
              {scan.stale && " · the room may have changed"}
            </span>
          )}
        </div>
        {(cafe.address || distance || onRequestDistance) && (
          <p className={cn("flex flex-wrap items-center gap-x-1.5 text-sm", t.muted)}>
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {cafe.address && <span>{cafe.address}</span>}
            {cafe.address && (distance || onRequestDistance) && <span>·</span>}
            {distance ? (
              <span>{distance}</span>
            ) : (
              onRequestDistance && (
                <button type="button" onClick={onRequestDistance} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 opacity-90 hover:opacity-100">
                  <LocateFixed className="size-3.5" aria-hidden="true" /> Show distance
                </button>
              )
            )}
          </p>
        )}
      </header>

      {/* 2. What can I do? */}
      <div>{actions}</div>

      {/* 3. Good to know: one rounded tile per fact. */}
      <section aria-label="Good to know" className="grid gap-2.5">
        <h3 className={sectionTitle}>Good to know</h3>
        {facts.length > 0 ? (
          <dl className="grid grid-cols-2 gap-2">
            {facts.map((row) => {
              const Icon = row.icon ? amenityIcon(row.icon) : (FACT_ICONS[row.key] ?? Info);
              const wide = row.text.length > 22;
              return (
                <div key={row.key} className={cn("flex items-center gap-2.5 rounded-[1.125rem] p-3", dark ? "bg-white/[0.07] ring-1 ring-white/10" : "bg-muted", wide && "col-span-2")}>
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", dark ? "bg-sky/25 text-mist" : "bg-card text-primary")} aria-hidden="true">
                    <Icon className="size-[1.125rem]" />
                  </span>
                  <div className="min-w-0">
                    <dt className={cn("text-xs", t.muted)}>{row.label}</dt>
                    <dd className="text-sm leading-snug font-semibold">{row.text}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className={cn("text-sm", t.muted)}>Not listed yet.</p>
        )}
      </section>

      {/* 4. Hours: a week strip with today marked, then one line or a row per day. */}
      <section aria-label="Opening hours" className={cn("grid gap-3 rounded-[1.25rem] p-4 ring-1", dark ? "ring-white/15" : "ring-accent")}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className={sectionTitle}>Hours</h3>
          {summary.note && <span className={cn("text-xs font-semibold", summary.open ? t.positive : t.muted)}>{summary.note.charAt(0).toUpperCase() + summary.note.slice(1)}</span>}
        </div>
        {hours.length > 0 ? (
          <>
            <div className="flex justify-between" aria-hidden="true">
              {hours.map((row) => (
                <span
                  key={row.day}
                  className={cn(
                    "grid size-9 place-items-center rounded-full text-xs font-semibold",
                    row.day === today ? (dark ? "bg-cloud text-navy" : "bg-foreground text-white") : dark ? "bg-white/[0.08]" : "bg-muted",
                    row.text === "Closed" && row.day !== today && "line-through opacity-50",
                  )}
                >
                  {row.label.charAt(0)}
                </span>
              ))}
            </div>
            {sameEveryDay ? (
              <p className="text-sm"><b className="font-semibold">Every day</b> · {sameEveryDay}</p>
            ) : (
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
            )}
          </>
        ) : (
          <p className={cn("text-sm", t.muted)}>Hours not listed yet.</p>
        )}
      </section>

      {/* 5. Events and menu, only when the cafe has them. Side by side when wide. */}
      <div className="flex flex-wrap gap-x-5 gap-y-4 empty:hidden">
        <EventList
          venueId={cafe.id}
          className="min-w-0 flex-1 basis-44"
          headingClassName={sectionTitle}
          itemClassName={t.item}
        />
        {cafe.menu.length > 0 && (
          <section aria-label="Menu" className="grid min-w-0 flex-1 basis-44 content-start gap-2">
            <h3 className={sectionTitle}>Menu</h3>
            <ul className="grid gap-1.5 text-sm">
              {cafe.menu.slice(0, MENU_PREVIEW).map((item, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{item.name}</span>
                  {item.price_php !== undefined && <span className="shrink-0 tabular-nums">{formatPhp(item.price_php)}</span>}
                </li>
              ))}
            </ul>
            {cafe.menu.length > MENU_PREVIEW && (
              <Button variant="secondary" size="sm" className="mt-1 w-full rounded-full" onClick={onOpenMenu}>
                See full menu ({cafe.menu.length} items)
              </Button>
            )}
          </section>
        )}
      </div>

      {/* 6. Last: a quiet way to report changes. */}
      {facts.length > 0 && <AccuracyCheck rows={facts} venueId={cafe.id} returnPath={accuracyReturnPath} tone={tone} />}
    </div>
  );
}

/** Icons for the "Good to know" tiles, by amenity key; anything else gets Info. */
const FACT_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  power_outlets: Plug,
  tables: Armchair,
  table_types: Armchair,
  seats: Users,
  climate: Snowflake,
  payment_methods: CreditCard,
  parking: Car,
};

interface ActionProps {
  /** Map: the big "Step inside in 3D" (or "I want to see inside") control. */
  primary?: ReactNode;
  onDirections: (() => void) | null;
  onReviews: () => void;
  onMenu?: (() => void) | null;
  /** Shows a Save button for this cafe. */
  saveSlug?: string;
  tone?: "dark" | "light";
  /** Kept for callers; the round buttons already meet the 44 px target. */
  touch?: boolean;
}

/** Section 2: the main control, then round labelled quick actions. */
export function CafeActions({ primary, onDirections, onReviews, onMenu, saveSlug, tone = "light" }: ActionProps) {
  const saved = useStore($saved);
  const isSaved = saveSlug ? saved.includes(saveSlug) : false;
  const dark = tone === "dark";
  const items: { label: string; icon: LucideIcon; onClick: () => void; pressed?: boolean }[] = [];
  if (onDirections) items.push({ label: "Directions", icon: Navigation, onClick: onDirections });
  items.push({ label: "Reviews", icon: MessageSquare, onClick: onReviews });
  if (onMenu) items.push({ label: "Menu", icon: UtensilsCrossed, onClick: onMenu });
  if (saveSlug) items.push({ label: isSaved ? "Saved" : "Save", icon: Heart, onClick: () => toggleSaved(saveSlug), pressed: isSaved });
  return (
    <div className="grid gap-4">
      {primary}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 3)}, minmax(0, 1fr))` }}>
        {items.map(({ label, icon: Icon, onClick, pressed }) => (
          <button key={label} type="button" onClick={onClick} aria-pressed={pressed} className="group grid justify-items-center gap-1.5 text-xs font-medium">
            <span className={cn("grid size-13 place-items-center rounded-full transition-colors", dark ? "bg-white/10 ring-1 ring-mist/25 group-hover:bg-white/20" : "bg-accent text-primary group-hover:bg-mist/60")}>
              <Icon className={cn("size-5", pressed && "fill-current")} aria-hidden="true" />
            </span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@visita/ui/utils";
import { supabase } from "@/lib/supabase";
import { compact, FILTER_LABEL, fillDays, heatGrid, rangeFor, share, type DayPoint, type VenueStats } from "./analytics-data";
import { useVenue } from "./VenueLayout";

// PRD 4.4 analytics for owners: totals only, from venue_stats(). Counted only
// for visitors who allowed usage statistics, so these are a floor, not every
// visit. Charts follow the dataviz method: validated categorical slots (blue,
// orange, aqua; aqua < 3:1, so every line is direct-labelled and a table view
// exists), a one-hue sequential ramp for the heatmap, 2px lines, hairline grid.

const VIZ: CSSProperties = {
  // Light only for now: the app has no dark theme yet.
  ["--surface-1" as string]: "#ffffff",
  ["--surface-2" as string]: "#f0efec",
  ["--grid" as string]: "#e4e3df",
  ["--series-1" as string]: "#2a78d6",
  ["--series-2" as string]: "#eb6834",
  ["--series-3" as string]: "#1baf7a",
};
const SEQ = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

const RANGES = [7, 30, 90] as const;
const SERIES: { key: keyof Omit<DayPoint, "day">; label: string; color: string }[] = [
  { key: "profile_view", label: "Profile views", color: "var(--series-1)" },
  { key: "walkthrough_open", label: "Walkthrough opens", color: "var(--series-2)" },
  { key: "directions_tap", label: "Directions taps", color: "var(--series-3)" },
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const shortDate = (day: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

function niceMax(n: number): number {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => n <= s * 4) ?? 10 * pow;
  return step * 4;
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="grid content-start gap-1 rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e!.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function DailyChart({ days }: { days: DayPoint[] }) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 220;
  const pad = { top: 12, right: 132, bottom: 28, left: 36 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...days.flatMap((d) => SERIES.map((s) => d[s.key]))));
  const x = (i: number) => pad.left + (days.length <= 1 ? w / 2 : (i / (days.length - 1)) * w);
  const y = (v: number) => pad.top + h - (v / max) * h;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const labelEvery = Math.ceil(days.length / Math.max(2, Math.floor(w / 70)));
  const last = days.length - 1;

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left - pad.left;
    const i = Math.round((px / Math.max(1, w)) * last);
    setHover(Math.min(last, Math.max(0, i)));
  };

  return (
    <div ref={wrap} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Daily profile views, walkthrough opens and directions taps"
        onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((i) => Math.min(last, (i ?? -1) + 1));
          if (e.key === "ArrowLeft") setHover((i) => Math.max(0, (i ?? last + 1) - 1));
        }}
        onBlur={() => setHover(null)}
        className="overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {compact(t)}
            </text>
          </g>
        ))}
        {days.map((d, i) =>
          i % labelEvery === 0 || i === last ? (
            <text key={d.day} x={x(i)} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {shortDate(d.day)}
            </text>
          ) : null,
        )}
        {SERIES.map((s) => (
          <polyline
            key={s.key}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={days.map((d, i) => `${x(i)},${y(d[s.key])}`).join(" ")}
          />
        ))}
        {/* End dots and direct labels (text in text tokens, identity from the dot). */}
        {SERIES.map((s, si) => {
          const v = days[last]?.[s.key] ?? 0;
          return (
            <g key={s.key}>
              <circle cx={x(last)} cy={y(v)} r={4} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} />
              <text x={pad.left + w + 12} y={pad.top + 14 + si * 20} className="fill-foreground text-[12px]">
                <tspan className="font-semibold tabular-nums">{compact(days.reduce((a, d) => a + d[s.key], 0))}</tspan> {s.label.toLowerCase()}
              </text>
              <line x1={pad.left + w + 2} x2={pad.left + w + 9} y1={pad.top + 10 + si * 20} y2={pad.top + 10 + si * 20} stroke={s.color} strokeWidth={2} />
            </g>
          );
        })}
        {hover !== null && days[hover] && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + h} stroke="var(--foreground)" strokeOpacity={0.35} strokeWidth={1} />
            {SERIES.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(days[hover]![s.key])} r={4} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && days[hover] && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 grid gap-0.5 rounded-lg border bg-card px-3 py-2 text-xs shadow-md"
          style={{ left: Math.min(x(hover) + 12, width - 170) }}
        >
          <p className="font-medium">{shortDate(days[hover]!.day)}</p>
          {SERIES.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3" style={{ background: s.color }} aria-hidden="true" />
              <span className="font-semibold tabular-nums">{days[hover]![s.key]}</span>
              <span className="text-muted-foreground">{s.label.toLowerCase()}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Heatmap({ grid }: { grid: { rows: number[][]; max: number } }) {
  const [tip, setTip] = useState<{ d: number; h: number } | null>(null);
  const step = (n: number) => (n === 0 || grid.max === 0 ? null : SEQ[Math.min(SEQ.length - 1, Math.floor((n / grid.max) * (SEQ.length - 1) + 0.0001))]!);
  return (
    <div className="relative grid gap-2">
      <div className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-[2px] text-[10px] text-muted-foreground">
        <span />
        {Array.from({ length: 24 }, (_, hr) => (
          <span key={hr} className="text-center">
            {hr % 3 === 0 ? hourLabel(hr) : ""}
          </span>
        ))}
        {grid.rows.map((row, d) => (
          <div key={d} className="contents">
            <span className="self-center pr-1 text-xs">{DAYS[d]}</span>
            {row.map((n, hr) => {
              const fill = step(n);
              return (
                <button
                  key={hr}
                  type="button"
                  aria-label={`${DAYS[d]} ${hourLabel(hr)}: ${n} ${n === 1 ? "view" : "views"}`}
                  onPointerEnter={() => setTip({ d, h: hr })}
                  onPointerLeave={() => setTip(null)}
                  onFocus={() => setTip({ d, h: hr })}
                  onBlur={() => setTip(null)}
                  className="aspect-square min-h-3 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ background: fill ?? "var(--surface-2)" }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Fewer views</span>
        {SEQ.map((c) => (
          <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} aria-hidden="true" />
        ))}
        <span>More</span>
        {tip && (
          <span role="status" className="ml-auto font-medium text-foreground">
            {DAYS[tip.d]} {hourLabel(tip.h)}–{hourLabel((tip.h + 1) % 24)}: {grid.rows[tip.d]![tip.h]} {grid.rows[tip.d]![tip.h] === 1 ? "view" : "views"}
          </span>
        )}
      </div>
    </div>
  );
}

function FilterBars({ filters }: { filters: VenueStats["filters"] }) {
  const max = Math.max(1, ...filters.map((f) => f.count));
  return (
    <ul className="grid gap-2">
      {filters.map((f) => (
        <li key={f.filter} className="grid grid-cols-[8rem_1fr] items-center gap-3 text-sm">
          <span>{FILTER_LABEL[f.filter] ?? f.filter}</span>
          <span className="flex items-center gap-2">
            <span
              className="h-5 rounded-r-[4px]"
              style={{ width: `${(f.count / max) * 80}%`, minWidth: 4, background: "var(--series-1)" }}
              title={`${f.count} ${f.count === 1 ? "visit" : "visits"}`}
            />
            <span className="font-semibold tabular-nums">{f.count}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, subtitle, table, children }: { title: string; subtitle?: string; table?: ReactNode; children: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="grid content-start gap-3 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {table && (
          <button type="button" className="text-sm underline underline-offset-2" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
            {asTable ? "Show chart" : "Show as table"}
          </button>
        )}
      </div>
      {asTable && table ? <div className="overflow-x-auto">{table}</div> : children}
    </section>
  );
}

export function Analytics() {
  const { venue } = useVenue();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [stats, setStats] = useState<VenueStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const range = useMemo(() => rangeFor(days, new Date()), [days]);

  useEffect(() => {
    let live = true;
    setStats(null);
    setError(null);
    supabase.rpc("venue_stats", { p_venue_id: venue.id, p_from: range.from, p_to: range.to }).then(({ data, error: e }) => {
      if (!live) return;
      if (e) setError("Couldn't load your stats. Try again.");
      else setStats(data as unknown as VenueStats);
    });
    return () => {
      live = false;
    };
  }, [venue.id, range]);

  const series = useMemo(() => (stats ? fillDays(stats.daily, range) : []), [stats, range]);
  const grid = useMemo(() => heatGrid(stats?.peak ?? []), [stats]);
  const t = stats?.totals;

  return (
    <div className="grid gap-6" style={VIZ}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">How visitors find you</h2>
          <p className="text-sm text-muted-foreground">Counted only for visitors who allow usage statistics, so real numbers are higher.</p>
        </div>
        <div role="group" aria-label="Time range" className="inline-flex rounded-lg border bg-card p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={days === r}
              onClick={() => setDays(r)}
              className={cn("rounded-md px-3 py-1.5 text-sm", days === r ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert">{error}</p>}
      {!stats && !error && <p className="text-muted-foreground">Loading…</p>}
      {stats && t && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="Profile views" value={compact(t.profile_view)} />
            <StatTile label="Walkthrough opens" value={compact(t.walkthrough_open)} />
            <StatTile label="Directions taps" value={compact(t.directions_tap)} />
            <StatTile label="Conversion" value={share(stats.conversion)} note="Directions taps per profile view" />
            <StatTile label="Search appearances" value={compact(t.search_appearance)} note="Times you showed up in search" />
          </div>

          <Section
            title="Day by day"
            subtitle={`Last ${days} days, Philippine time`}
            table={
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-4 font-medium">Day</th>
                    {SERIES.map((s) => (
                      <th key={s.key} className="py-1 pr-4 text-right font-medium">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {series.map((d) => (
                    <tr key={d.day} className="border-t">
                      <td className="py-1 pr-4">{shortDate(d.day)}</td>
                      {SERIES.map((s) => (
                        <td key={s.key} className="py-1 pr-4 text-right">
                          {d[s.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden="true">
              {SERIES.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4" style={{ background: s.color }} /> {s.label}
                </span>
              ))}
            </div>
            <DailyChart days={series} />
          </Section>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Section
              title="When people look you up"
              subtitle="Profile views by day and hour"
              table={
                <table className="text-xs tabular-nums">
                  <thead>
                    <tr>
                      <th />
                      {Array.from({ length: 24 }, (_, hr) => (
                        <th key={hr} className="px-1 font-medium text-muted-foreground">
                          {hr}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.rows.map((row, d) => (
                      <tr key={d}>
                        <th className="pr-2 text-left font-medium">{DAYS[d]}</th>
                        {row.map((n, hr) => (
                          <td key={hr} className="px-1 text-center">
                            {n || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              {grid.max === 0 ? <p className="text-sm text-muted-foreground">No profile views in this range yet.</p> : <Heatmap grid={grid} />}
            </Section>

            <Section title="Filters that brought people in" subtitle="Filters that were on when someone opened your cafe">
              {stats.filters.length === 0 ? <p className="text-sm text-muted-foreground">Nobody has found you through filters in this range yet.</p> : <FilterBars filters={stats.filters} />}
            </Section>
          </div>

          <StatTile
            label="Asked for a 3D scan before you joined"
            value={compact(stats.demand_before_signup)}
            note={`Visitors who tapped "I want to see inside" on ${venue.name} before you claimed it, all time`}
          />
        </>
      )}
    </div>
  );
}

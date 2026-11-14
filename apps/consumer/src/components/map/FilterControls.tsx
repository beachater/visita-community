import { Clock, type LucideIcon } from "lucide-react";
import { amenityIcon } from "@visita/ui/amenity-icon";
import { cn } from "@visita/ui/utils";
import { PRICE_CAPS, setMinimum, toggleRequired, type FilterOption, type Filters } from "@/lib/discovery/filters";

// The filter choices, shared by the desktop panel and the phone sheets
// (approved desktop filters, 2026-11-14): pills for price and "N or more",
// icon tiles for "must have". The amenity rows come from the database
// (`amenity_definitions.is_filterable`), so a new filter needs no code.

interface Props {
  options: FilterOption[];
  filters: Filters;
  onChange: (f: Filters) => void;
}

// Every option pill is the same width, whatever its text, so groups line up in columns.
const pill = "h-10 rounded-full border px-2 text-sm font-medium transition-colors hover:bg-accent";
const pillOn = "border-foreground bg-foreground text-white hover:bg-foreground";

function Pills<T>({ legend, choices, value, label, onPick }: { legend: string; choices: (T | null)[]; value: T | null; label: (v: T | null) => string; onPick: (v: T | null) => void }) {
  return (
    <fieldset className="grid gap-2.5">
      <legend className="mb-2.5 text-sm font-semibold">{legend}</legend>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
        {choices.map((c) => (
          <button key={String(c)} type="button" aria-pressed={value === c} className={cn(pill, value === c && pillOn)} onClick={() => onPick(c)}>
            {label(c)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Tile({ label, icon: Icon, on, onClick }: { label: string; icon: LucideIcon; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("flex h-13 items-center gap-2.5 rounded-2xl border border-accent bg-card px-3 text-left text-sm font-medium transition-colors hover:border-mist", on && "border-primary bg-muted ring-1 ring-primary")}
    >
      <span className={cn("grid size-7.5 shrink-0 place-items-center rounded-full", on ? "bg-primary text-white" : "bg-accent text-primary")} aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

export function FilterControls({ options, filters, onChange }: Props) {
  const minimums = options.filter((o) => o.kind === "minimum");
  const flags = options.filter((o) => o.kind === "flag");
  return (
    <div className="grid gap-5.5">
      <Pills legend="Menu prices up to" choices={[null, ...PRICE_CAPS]} value={filters.priceMax} label={(p) => (p === null ? "Any" : `₱${p}`)} onPick={(p) => onChange({ ...filters, priceMax: p })} />
      {minimums.map((o) => (
        <Pills
          key={o.key}
          legend={o.label}
          choices={[null, ...o.steps]}
          value={filters.minimums[o.key] ?? null}
          label={(n) => (n === null ? "Any" : `${n}+`)}
          onPick={(n) => onChange(setMinimum(filters, o.key, n))}
        />
      ))}
      <fieldset className="grid gap-2.5">
        <legend className="mb-2.5 text-sm font-semibold">Must have</legend>
        <div className="grid grid-cols-2 gap-2">
          {flags.map((o) => (
            <Tile key={o.key} label={o.label} icon={amenityIcon(o.icon)} on={filters.required.includes(o.key)} onClick={() => onChange(toggleRequired(filters, o.key))} />
          ))}
          <Tile label="Open 24/7" icon={Clock} on={filters.open247} onClick={() => onChange({ ...filters, open247: !filters.open247 })} />
        </div>
      </fieldset>
    </div>
  );
}

/** "Include N cafes that don't list these details yet", as a checkbox. */
export function IncludeUnknown({ count, checked, onChange }: { count: number; checked: boolean; onChange: (v: boolean) => void }) {
  if (count === 0) return null;
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-muted px-3.5 py-3 text-[0.8rem] leading-snug">
      <input type="checkbox" className="size-5 shrink-0 accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Include {count} {count === 1 ? "cafe that doesn't" : "cafes that don't"} list these details yet
    </label>
  );
}

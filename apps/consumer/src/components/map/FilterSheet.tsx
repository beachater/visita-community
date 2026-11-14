import { X } from "lucide-react";
import { Button } from "@visita/ui/button";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { EMPTY_FILTERS, type FilterOption, type FilterResult, type Filters } from "@/lib/discovery/filters";
import { FilterControls, IncludeUnknown } from "./FilterControls";

// PRD 4.1 filters with a live match count, and a one-tap override for cafes
// that don't list what's being filtered on. Phones get a bottom sheet;
// computers get FilterPanel, attached to the list card.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: FilterOption[];
  filters: Filters;
  onChange: (f: Filters) => void;
  result: FilterResult;
  showUnknown: boolean;
  onShowUnknown: (show: boolean) => void;
}

export function FilterSheet({ open, onOpenChange, options, filters, onChange, result, showUnknown, onShowUnknown }: Props) {
  const count = result.shown.length;
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filters"
      footer={
        <div className="grid gap-2">
          <IncludeUnknown count={result.hiddenForMissingData} checked={showUnknown} onChange={onShowUnknown} />
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => onChange(EMPTY_FILTERS)}>
              Clear
            </Button>
            <Button className="flex-1 rounded-full" onClick={() => onOpenChange(false)}>
              {count === 0 ? "No cafes match" : `Show ${count} ${count === 1 ? "cafe" : "cafes"}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="py-1">
        <FilterControls options={options} filters={filters} onChange={onChange} />
      </div>
    </BottomSheet>
  );
}

/** Computers: a panel beside the list card. No dimmed screen; the list and pins update as you choose. */
export function FilterPanel({ onClose, options, filters, onChange, result, showUnknown, onShowUnknown }: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const count = result.shown.length;
  return (
    <section
      aria-label="Filters"
      className="surface-raised pointer-events-auto absolute top-24 left-[24rem] z-30 flex max-h-[calc(100%-7rem)] w-[23.75rem] flex-col overflow-hidden rounded-card lg:left-[28.25rem]"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-2">
        <h2 className="text-[1.375rem]">Filters</h2>
        <button type="button" aria-label="Close filters" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-muted hover:bg-accent">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="scroll-soft grid min-h-0 gap-5.5 overflow-y-auto overscroll-contain px-5 pt-2 pb-5">
        <FilterControls options={options} filters={filters} onChange={onChange} />
        <IncludeUnknown count={result.hiddenForMissingData} checked={showUnknown} onChange={onShowUnknown} />
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-accent px-5 py-3.5">
        <span className="text-sm" aria-live="polite">
          <b className="font-bold">{count} {count === 1 ? "cafe" : "cafes"}</b> match · list updated
        </span>
        <button type="button" className="h-10 rounded-full border px-4 text-sm font-semibold hover:bg-accent" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear all
        </button>
      </div>
    </section>
  );
}

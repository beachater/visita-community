import { Button } from "@visita/ui/button";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { Label } from "@visita/ui/label";
import { Switch } from "@visita/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@visita/ui/select";
import { EMPTY_FILTERS, type FilterResult, type Filters } from "@/lib/discovery/filters";

// PRD 4.1 filters with a live match count, and a one-tap override for cafes
// that don't list what's being filtered on.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Filters;
  onChange: (f: Filters) => void;
  result: FilterResult;
  showUnknown: boolean;
  onShowUnknown: (show: boolean) => void;
}

const PRICE_CAPS = [100, 150, 200, 300, 500];
const OUTLETS = [1, 3, 5, 10];

export function FilterSheet({ open, onOpenChange, filters, onChange, result, showUnknown, onShowUnknown }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const toggles: { key: "wifi" | "open247" | "outdoor" | "parking"; label: string }[] = [
    { key: "wifi", label: "Wi-Fi available" },
    { key: "open247", label: "Open 24/7" },
    { key: "outdoor", label: "Outdoor area" },
    { key: "parking", label: "Parking" },
  ];
  const count = result.shown.length;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filters"
      footer={
        <div className="grid gap-2">
          {result.hiddenForMissingData > 0 && (
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                {result.hiddenForMissingData} {result.hiddenForMissingData === 1 ? "cafe doesn't" : "cafes don't"} list these details. Show them anyway
              </span>
              <Switch checked={showUnknown} onCheckedChange={onShowUnknown} aria-label="Show cafes without these details" />
            </label>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onChange(EMPTY_FILTERS)}>
              Clear
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              {count === 0 ? "No cafes match" : `Show ${count} ${count === 1 ? "cafe" : "cafes"}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 py-1">
        <div className="grid gap-2">
          <Label htmlFor="filter-price">Menu prices up to</Label>
          <Select value={filters.priceMax === null ? "any" : String(filters.priceMax)} onValueChange={(v) => set({ priceMax: v === "any" ? null : Number(v) })}>
            <SelectTrigger id="filter-price" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any price</SelectItem>
              {PRICE_CAPS.map((p) => (
                <SelectItem key={p} value={String(p)}>
                  ₱{p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-outlets">Power outlets</Label>
          <Select value={filters.minOutlets === null ? "any" : String(filters.minOutlets)} onValueChange={(v) => set({ minOutlets: v === "any" ? null : Number(v) })}>
            <SelectTrigger id="filter-outlets" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {OUTLETS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} or more
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {toggles.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-4">
            <Label htmlFor={`filter-${t.key}`}>{t.label}</Label>
            <Switch id={`filter-${t.key}`} checked={filters[t.key]} onCheckedChange={(c) => set({ [t.key]: c })} />
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

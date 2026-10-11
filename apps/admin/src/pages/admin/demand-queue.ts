// Sorting and filtering for the demand queue page. The totals come from
// admin_demand_queue(); this only decides what to show and in what order.

export interface DemandRow {
  venue_id: string;
  name: string;
  slug: string;
  address: string | null;
  is_published: boolean;
  /** Scanned since the requests came in: the demand has been met. */
  scanned: boolean;
  has_owner: boolean;
  total: number;
  last_7_days: number;
  last_30_days: number;
  /** Requests made while signed in. */
  signed_in: number;
  first_at: string;
  last_at: string;
}

export type DemandSort = "recent" | "total" | "latest";

export const DEMAND_SORTS: { value: DemandSort; label: string }[] = [
  { value: "recent", label: "Most wanted, last 30 days" },
  { value: "total", label: "Most wanted, all time" },
  { value: "latest", label: "Latest request" },
];

const by: Record<DemandSort, (a: DemandRow, b: DemandRow) => number> = {
  recent: (a, b) => b.last_30_days - a.last_30_days || b.total - a.total,
  total: (a, b) => b.total - a.total || b.last_30_days - a.last_30_days,
  latest: (a, b) => b.last_at.localeCompare(a.last_at),
};

export function demandView(rows: DemandRow[], { sort, showScanned }: { sort: DemandSort; showScanned: boolean }): DemandRow[] {
  return rows.filter((r) => showScanned || !r.scanned).sort(by[sort]);
}

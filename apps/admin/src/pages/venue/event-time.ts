// Event times are entered and shown in Manila time (UTC+8, no daylight
// saving), whatever the owner's device is set to.

const OFFSET = "+08:00";
const INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "2026-10-02T18:30" (Manila) → ISO instant, or null if not a valid value. */
export function manilaInputToIso(value: string): string | null {
  if (!INPUT.test(value)) return null;
  const date = new Date(`${value}:00${OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO instant → "2026-10-02T18:30" in Manila, for a datetime-local input. */
export function isoToManilaInput(iso: string): string {
  return new Date(new Date(iso).getTime() + 8 * 3_600_000).toISOString().slice(0, 16);
}

export function eventWhen(startsAt: string, endsAt: string, now: Date): "past" | "now" | "upcoming" {
  if (new Date(endsAt) <= now) return "past";
  if (new Date(startsAt) <= now) return "now";
  return "upcoming";
}

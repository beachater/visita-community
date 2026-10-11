export const MAX_AMENITY_COMMENT = 300;

export type AmenityVerdict = "confirm" | "dispute";

export function parseAmenityReport(value: unknown):
  | { ok: true; report: { venueId: string; amenityKey: string; verdict: AmenityVerdict; comment: string | null } }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "Choose an amenity to check." };
  const input = value as Record<string, unknown>;
  if (typeof input.venueId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.venueId))
    return { ok: false, error: "This cafe isn't available right now." };
  if (typeof input.amenityKey !== "string" || !/^[a-z][a-z0-9_]*$/.test(input.amenityKey))
    return { ok: false, error: "Choose an amenity to check." };
  if (input.verdict !== "confirm" && input.verdict !== "dispute")
    return { ok: false, error: "Choose an option first." };
  if (input.comment !== undefined && input.comment !== null && typeof input.comment !== "string")
    return { ok: false, error: "Please check your note." };
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length > MAX_AMENITY_COMMENT)
    return { ok: false, error: `Keep your note under ${MAX_AMENITY_COMMENT} characters.` };
  if (input.verdict === "confirm" && comment)
    return { ok: false, error: "A confirmation doesn't need a note." };
  return { ok: true, report: { venueId: input.venueId, amenityKey: input.amenityKey, verdict: input.verdict, comment: input.verdict === "dispute" && comment ? comment : null } };
}

export function confirmationText(count: number): string | null {
  return Number.isInteger(count) && count > 0 ? `Confirmed by ${count} ${count === 1 ? "person" : "people"} recently` : null;
}

export function amenityReturnPath(slug: string, key: string, walkthrough: boolean): string {
  const params = new URLSearchParams({ amenity: key });
  if (walkthrough) params.set("walkthrough", "1");
  return `/cafe/${encodeURIComponent(slug)}?${params}#amenity-${encodeURIComponent(key)}`;
}

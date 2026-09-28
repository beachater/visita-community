import type { MapVenue } from "./venues";

// PRD 4.1 search over Visita's own venues (the Google Places fallback waits
// on a stakeholder decision). Every query word must appear in the venue's
// name, search terms or address; better matches rank higher, and scanned
// cafes come first among equals.

/** Lowercase, no accents, no apostrophes or punctuation, single spaces. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function score(v: MapVenue, query: string, words: string[]): number | null {
  const name = normalize(v.name);
  const haystack = [name, ...v.searchTerms.map(normalize), normalize(v.address ?? "")].join(" | ");
  if (!words.every((w) => haystack.includes(w))) return null;
  if (name.startsWith(query)) return 0;
  if (name.split(" ").some((word) => word.startsWith(words[0]!))) return 1;
  if (name.includes(words[0]!)) return 2;
  return 3;
}

export function searchVenues(venues: MapVenue[], rawQuery: string): MapVenue[] {
  const query = normalize(rawQuery);
  if (!query) return [];
  const words = query.split(" ");
  return venues
    .map((v) => ({ v, s: score(v, query, words) }))
    .filter((r): r is { v: MapVenue; s: number } => r.s !== null)
    .sort((a, b) => a.s - b.s || Number(b.v.scanned) - Number(a.v.scanned) || a.v.name.localeCompare(b.v.name))
    .map((r) => r.v);
}

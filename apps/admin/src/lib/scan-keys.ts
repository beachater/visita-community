// Scan storage keys (PRD 4.5 scan uploads). Every upload is a new version,
// splats/<slug>/v<n>.sog plus v<n>-preview.sog, so files can be cached as
// immutable and an upload never replaces a scan visitors are loading.

export type ScanKind = "full" | "preview";

/** R2 multipart parts must be at least 5 MB (except the last); 25 MB keeps each request well under Worker limits. */
export const PART_SIZE = 25 * 1024 * 1024;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function nextVersion(keys: string[], slug: string): number {
  const re = new RegExp(String.raw`^splats/${slug}/v(\d+)(?:-preview)?\.sog$`);
  let max = 0;
  for (const k of keys) {
    const m = re.exec(k);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export function scanKey(slug: string, version: number, kind: ScanKind): string {
  return `splats/${slug}/v${version}${kind === "preview" ? "-preview" : ""}.sog`;
}

export function isScanKeyFor(key: string, slug: string): boolean {
  return SLUG.test(slug) && new RegExp(String.raw`^splats/${slug}/v\d+(?:-preview)?\.sog$`).test(key);
}

/** Any venue's versioned scan key (the Worker checks this on every upload part). */
export const isScanKey = (key: string) => /^splats\/[a-z0-9]+(-[a-z0-9]+)*\/v\d+(?:-preview)?\.sog$/.test(key);

export const partCount =(size: number) => Math.max(1, Math.ceil(size / PART_SIZE));

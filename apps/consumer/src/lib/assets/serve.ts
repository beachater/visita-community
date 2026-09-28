// Serving public assets (scans, the basemap) from Visita's own domain via
// the Worker's R2 binding. r2.dev URLs are rate-limited, meant for
// development, and resolve as "no such domain" on some networks, so a visitor
// who can open the site must be able to load its assets from the same place.

/** Public prefixes. Everything else in the bucket (owner proofs, drafts) stays private. */
const PUBLIC_PREFIXES = ["splats/", "basemaps/"];

export function isServableKey(key: string): boolean {
  if (!key || key.includes("..") || key.includes("//") || key.startsWith("/")) return false;
  return PUBLIC_PREFIXES.some((p) => key.startsWith(p));
}

interface ObjectInfo {
  size: number;
  httpEtag: string;
  contentType?: string;
  cacheControl?: string;
}

export interface ByteRange {
  offset: number;
  length: number;
}

export function assetHeaders(object: ObjectInfo, range: ByteRange | null): { status: 200 | 206; headers: Headers } {
  const headers = new Headers({
    "content-type": object.contentType ?? "application/octet-stream",
    "cache-control": object.cacheControl ?? "public, max-age=3600",
    etag: object.httpEtag,
    "accept-ranges": "bytes",
    // The embed widget loads scans from cafe owners' own websites.
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "Content-Length, Content-Range, ETag",
  });
  if (range) {
    headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    headers.set("content-length", String(range.length));
    return { status: 206, headers };
  }
  headers.set("content-length", String(object.size));
  return { status: 200, headers };
}

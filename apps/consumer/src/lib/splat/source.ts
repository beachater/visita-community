// Resolving `venues.splat_url` keys to loadable URLs, and telling formats apart.

export type SplatFormat = "sog" | "streamed";

/** `splats/sonnys/v1.sog` → bundled; `splats/sonnys/v1/lod-meta.json` → streamed. */
export function splatFormat(keyOrUrl: string): SplatFormat {
  return /(^|\/)lod-meta\.json(\?|$)/.test(keyOrUrl) ? "streamed" : "sog";
}

/**
 * Joins an R2 key onto the public assets base: "/assets" (same origin, served
 * by the Worker from R2) unless PUBLIC_ASSETS_BASE_URL says otherwise, e.g. an
 * absolute URL for the embed widget on other sites. Absolute keys pass through.
 */
export function splatSrc(key: string, base = import.meta.env.PUBLIC_ASSETS_BASE_URL || "/assets"): string {
  if (/^https?:\/\//.test(key)) return key;
  return `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

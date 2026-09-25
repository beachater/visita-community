// Resolving `venues.splat_url` keys to loadable URLs, and telling formats apart.

export type SplatFormat = "sog" | "streamed";

/** `splats/sonnys/v1.sog` → bundled; `splats/sonnys/v1/lod-meta.json` → streamed. */
export function splatFormat(keyOrUrl: string): SplatFormat {
  return /(^|\/)lod-meta\.json(\?|$)/.test(keyOrUrl) ? "streamed" : "sog";
}

/** Joins an R2 key onto the public assets base. Absolute URLs pass through. */
export function splatSrc(key: string, base = import.meta.env.PUBLIC_ASSETS_BASE_URL ?? ""): string {
  if (/^https?:\/\//.test(key)) return key;
  return `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

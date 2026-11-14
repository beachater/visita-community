import { parseScanExperience, type ScanExperience } from "@visita/shared-types";

// The one venue an embed shows: read from Supabase's public REST API with the
// browser (publishable) key. RLS returns published venues only, and the
// filters below say the same thing explicitly.

export interface EmbedConfig {
  supabaseUrl: string;
  publishableKey: string;
  /** Prefix for R2 keys, e.g. https://visita.ph/assets */
  assetsBaseUrl: string;
  /** Where the badge links, e.g. https://visita.ph */
  siteUrl: string;
}

export interface EmbedVenue {
  slug: string;
  name: string;
  /** Loadable URL of the full .sog */
  src: string;
  /** Loadable URL of the decimated preview .sog, when the scan has one */
  previewSrc: string | null;
  experience: ScanExperience | null;
}

interface VenueRow {
  slug: string;
  name: string;
  splat_url: string | null;
  splat_preview_url: string | null;
  scan_experience: unknown;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The slug from `?venue=`, or null when it's missing or can't be a slug. */
export function venueSlug(search: string): string | null {
  const slug = new URLSearchParams(search).get("venue")?.trim().toLowerCase() ?? "";
  return slug.length > 0 && slug.length <= 120 && SLUG.test(slug) ? slug : null;
}

const trimEnd = (url: string) => url.replace(/\/+$/, "");

/** Joins an R2 key onto the assets base. Absolute URLs pass through. */
export function assetUrl(key: string, base: string): string {
  if (/^https?:\/\//.test(key)) return key;
  return `${trimEnd(base)}/${key.replace(/^\/+/, "")}`;
}

/** The full listing on Visita: the badge's destination. */
export function listingUrl(siteUrl: string, slug: string | null): string {
  return slug ? `${trimEnd(siteUrl)}/cafe/${encodeURIComponent(slug)}` : trimEnd(siteUrl);
}

export function venueQuery(config: EmbedConfig, slug: string): string {
  const params = new URLSearchParams({
    select: "slug,name,splat_url,splat_preview_url,scan_experience",
    slug: `eq.${slug}`,
    venue_type: "eq.cafe",
    is_published: "eq.true",
    limit: "1",
  });
  return `${trimEnd(config.supabaseUrl)}/rest/v1/venues?${params}`;
}

/** Null when the row is missing or the venue has no published scan. */
export function toEmbedVenue(row: VenueRow | undefined, assetsBaseUrl: string): EmbedVenue | null {
  if (!row?.splat_url) return null;
  return {
    slug: row.slug,
    name: row.name,
    src: assetUrl(row.splat_url, assetsBaseUrl),
    previewSrc: row.splat_preview_url ? assetUrl(row.splat_preview_url, assetsBaseUrl) : null,
    experience: parseScanExperience(row.scan_experience),
  };
}

export class VenueLoadError extends Error {}

/** The published scan for `slug`, or null when there isn't one. Throws VenueLoadError on network/API failure. */
export async function loadVenue(config: EmbedConfig, slug: string, fetchImpl: typeof fetch = fetch): Promise<EmbedVenue | null> {
  let response: Response;
  try {
    response = await fetchImpl(venueQuery(config, slug), {
      headers: { apikey: config.publishableKey, accept: "application/json" },
    });
  } catch {
    throw new VenueLoadError("network");
  }
  if (!response.ok) throw new VenueLoadError(`status ${response.status}`);
  const rows = (await response.json()) as VenueRow[];
  return toEmbedVenue(Array.isArray(rows) ? rows[0] : undefined, config.assetsBaseUrl);
}

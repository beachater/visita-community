import { env } from "cloudflare:workers";
import { assetHeaders, isServableKey, type ByteRange } from "./serve";

// Streams a public asset from the R2 binding. Shared by /assets (cached,
// immutable) and /lab/assets (no-store, so measurements always download).
export async function serveAsset(request: Request, key: string, opts: { withBody: boolean; noStore?: boolean }): Promise<Response> {
  if (!isServableKey(key)) return new Response("Not found", { status: 404 });

  const wantsRange = request.headers.has("range");
  // With onlyIf, R2 returns metadata only (no body) when the precondition fails.
  const object: R2ObjectBody | R2Object | null = await env.ASSETS_BUCKET.get(key, {
    range: request.headers,
    onlyIf: opts.noStore ? undefined : request.headers,
  });
  if (object === null) return new Response("Not found", { status: 404 });

  // A matched If-None-Match returns metadata without a body.
  if (!("body" in object)) return new Response(null, { status: 304, headers: { etag: object.httpEtag } });

  let range: ByteRange | null = null;
  if (wantsRange && object.range) {
    const r = object.range as { offset?: number; length?: number; suffix?: number };
    if (r.suffix !== undefined) range = { offset: object.size - r.suffix, length: r.suffix };
    else {
      const offset = r.offset ?? 0;
      range = { offset, length: r.length ?? object.size - offset };
    }
  }

  const { status, headers } = assetHeaders(
    {
      size: object.size,
      httpEtag: object.httpEtag,
      contentType: object.httpMetadata?.contentType,
      cacheControl: opts.noStore ? "no-store" : object.httpMetadata?.cacheControl,
    },
    range,
  );
  return new Response(opts.withBody ? object.body : null, { status, headers });
}

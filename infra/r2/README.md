# R2 assets

| Bucket | Used by |
| --- | --- |
| `visita-assets` (production, APAC) | Deployed Workers (`bucket_name` in both `wrangler.jsonc` files) |
| `visita-assets-dev` (development, APAC) | Local dev (`preview_bucket_name`), so test uploads never reach production |

Both Workers serve the bucket through their own domain (`/assets/<key>` on the
consumer site), so neither bucket needs a public `r2.dev` URL.

The commands below use `<bucket>`. Use `visita-assets` for anything visitors
should see, and `visita-assets-dev` to try something out first. A new
production bucket also needs the CORS rule below and a copy of the existing
objects (scans, basemap, and `owner-proofs/`).

## Layout

```
splats/<slug>/v<n>.sog    PlayCanvas bundled SOG. A rescan uploads v<n+1>;
                          files are never overwritten, so they're cached immutable.
```

`venues.splat_url` stores the key (`splats/sonnys/v1.sog`), and apps prefix it
with `PUBLIC_ASSETS_BASE_URL` / `VITE_ASSETS_BASE_URL`.

## CORS

`cors.json` allows GET/HEAD from any origin: the embed widget runs on
third-party sites (PRD 5.4). Apply changes with:

```sh
npx wrangler r2 bucket cors set <bucket> --file infra/r2/cors.json
```

## Making a scan (.ply → .sog)

With `@playcanvas/splat-transform` (v3.9). On this laptop pass `-g 1` (the RTX
4050); adapter 0 is the integrated AMD GPU, which hits GPU timeouts on big scans.

```sh
# Full scan
npx @playcanvas/splat-transform -g 1 <slug>.ply <slug>.sog

# Preview (~300K splats, loads first). Decimation must be the last action and
# write a .ply, so it takes two steps.
npx @playcanvas/splat-transform <slug>.ply -d 300000 <slug>-300k.ply
npx @playcanvas/splat-transform -g 1 <slug>-300k.ply <slug>-preview.sog

# Check both: each must report its gaussian count
npx @playcanvas/splat-transform <slug>.sog null
npx @playcanvas/splat-transform <slug>-preview.sog null
```

Optional clean-up before the output name: `-N` drops NaN/broken gaussians, `-F`
removes floaters. `-w` overwrites an existing output.

The admin app handles publication: **Venues → the cafe → 3D scan**. Upload a
full `.sog` (and optionally a small preview) as a draft. In **Set up scan**,
orient the room, save the entrance view, add walkable-area corners and optional
tour stops, test the boundary, then publish. The existing live scan stays in
place until publication. The CLI route below is still useful for importing
assets, but does not create the admin draft or visitor setup.

## Uploading a scan

A bundled `.sog` is an uncompressed zip of `meta.json` plus its `.webp`
textures. Bundle unbundled exports **without re-encoding** (re-encoding would
re-quantize the splats), check the result, then upload:

```sh
npx @playcanvas/splat-transform <slug>.sog null      # must report the gaussian count
npx wrangler r2 object put <bucket>/splats/<slug>/v1.sog \
  --file <slug>.sog --remote \
  --content-type application/octet-stream \
  --cache-control "public, max-age=31536000, immutable"
```

Session 2 moved Sonny's and Lito's (about 3.0M gaussians and 43 MB each) off the
prototype's CloudFront this way.

## Basemap (discovery map)

The map uses a Protomaps vector-tile extract of Cagayan de Oro, a single
PMTiles file served from this bucket. It costs $0, has no API key, and has no
commercial-licence issue.

```
basemaps/cdo-<build date>.pmtiles    about 10 MB; zoom 0–15; bbox 124.38,8.22 → 124.88,8.65
```

To make a new one with the official `pmtiles` CLI (github.com/protomaps/go-pmtiles;
verify the download against the release asset's SHA-256):

```sh
# The newest build name is listed at https://build-metadata.protomaps.dev/builds.json
pmtiles extract https://build.protomaps.com/<build>.pmtiles cdo.pmtiles \
  --bbox=124.38,8.22,124.88,8.65 --maxzoom=15
npx wrangler r2 object put <bucket>/basemaps/cdo-<build>.pmtiles \
  --file cdo.pmtiles --remote --content-type application/vnd.pmtiles \
  --cache-control "public, max-age=31536000, immutable"
```

Then point `PUBLIC_BASEMAP_KEY` at the new key. MapLibre reads the file with
HTTP range requests, which the bucket's CORS rules allow (`Range` in, and
`Content-Range` exposed).

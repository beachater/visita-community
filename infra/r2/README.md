# R2 assets

Bucket: `visita-assets-dev` (development, APAC). Production gets its own bucket
behind a custom domain; `r2.dev` URLs are rate-limited and dev-only.

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
npx wrangler r2 bucket cors set visita-assets-dev --file infra/r2/cors.json
```

## Uploading a scan

A bundled `.sog` is an uncompressed zip of `meta.json` plus its `.webp`
textures. Bundle unbundled exports **without re-encoding** (re-encoding would
re-quantize the splats), check the result, then upload:

```sh
npx @playcanvas/splat-transform <slug>.sog null      # must report the gaussian count
npx wrangler r2 object put visita-assets-dev/splats/<slug>/v1.sog \
  --file <slug>.sog --remote \
  --content-type application/octet-stream \
  --cache-control "public, max-age=31536000, immutable"
```

Session 2 moved Sonny's and Lito's (about 3.0M gaussians and 43 MB each) off the
prototype's CloudFront this way.

# Intro performance benchmark

Status: historical comparison. The recorded-map trial was removed from the consumer page after desktop review. The current consumer intro uses a static SVG poster and local vector geometry to rotate the globe. It makes no video or global tile requests.

Measured locally on 12 October 2026. These are controlled browser observations, not production traffic measurements.

## Method

- Isolated Chrome 154 headless session on Windows, portrait viewport 390 × 844 CSS pixels at 2× pixel ratio.
- Mobile simulation: 4× CPU slowdown, 150 ms added network latency, 200,000 bytes/second download limit (about 1.6 Mbps).
- First run disabled the browser's HTTP cache. Repeat run enabled it. The global tile CDN and local server may still have their own warm caches.
- Current intro used the built consumer app in an isolated Astro/Cloudflare local preview. Video used the standalone design benchmark page, so the video numbers exclude competition from the live CDO map. A full app integration must be measured separately.

## Results

| Scenario | First visible paint | Intro visual | End |
| --- | ---: | ---: | ---: |
| Current app, mobile simulation, cold | 1.21 s | Shell at 1.20 s; global globe did not start before fallback | Shell cleared at 6.20 s |
| Video sample, mobile simulation, cold | 0.36 s | Poster fetched by 0.93 s; video playing at 1.38 s | Video ended at 4.33 s |
| Video sample, mobile simulation, repeat | 0.23 s | Poster cached; video playing at 0.41 s | Video ended at 3.36 s |
| Current app, no throttle, cold | 0.22 s | Shell at 0.21 s | Flight overlay cleared at 3.88 s |

The current app's unthrottled run fetched the OpenFreeMap style in 0.63 s. Separate same-machine HTTP requests measured 49 KB for the style, 19 KB for the vector source metadata, and 237 KB for one representative globe raster tile. A single request does not measure the complete tile set or WebGL startup.

## Sample media

- `design/consumer-root/intro-flight-mobile-sample.mp4`: 379,164 bytes (370 KiB), 780 × 1688, 2.95 seconds, H.264 MP4.
- `design/consumer-root/intro-flight-mobile-poster.jpg`: 57,388 bytes (56 KiB), 780 × 1688.
- The sample records the map canvas. Its black surroundings are blended against a navy background in the benchmark page; the poster has the full background. It is a size/startup sample, not a release asset.

## Finding and next check

The video approach can show a detailed frame before the global map code or tiles arrive. In this isolated test, video playback started far earlier than the current globe on the throttled profile. The poster's network request finished at about 0.93 s on the cold run; first paint at 0.36 s was the page background/text. The current intro also had a slow-script replay race; its inline Skip and timeout now prevent the flight from reappearing after fallback.

## Integrated trial, local harness

The recorded flight was briefly wired into the consumer root page. Its Astro component was tested in an isolated static page because the local production build's Cloudflare remote preview step requires network access while loading `.dev.vars` secrets. Automatic approval review rejected that network-enabled build. These historical measurements verified the former component and media, but did not include competition from the full CDO map:

- Mobile simulation, cold: first paint 0.30 s, poster loaded 0.99 s, video playing 1.52 s, intro cleared on video end 4.48 s.
- Landscape trial, same simulated network and CPU: first paint 0.28 s, poster loaded 0.92 s, video playing 1.35 s, intro cleared on video end 4.36 s.
- Skip clears immediately; a later visit in the same session stays clear; reduced-motion preference keeps it hidden.
- Desktop initially used a cropped portrait sample, which made the globe look like a flat oval. That was replaced with a separate 1440 × 900 landscape recording (328,555 bytes) and matching poster (52,934 bytes). Desktop visual was reviewed at the start and near the CDO handoff.

After desktop review, the recorded flight was removed in favor of the illustrated intro. These numbers should not be used as current consumer-page performance figures.

## Current rotating globe, isolated local check

The current globe was checked in a standalone copy of its component on 12 October 2026 using the same simulated phone profile as above. This excludes the CDO map and app bundle:

| First paint | SVG poster loaded | Globe rotation started | Intro cleared |
| ---: | ---: | ---: | ---: |
| 0.22 s | 0.93 s | 1.35 s | 4.43 s |

A repeat visit in the same session made no intro asset requests. The renderer uses local Natural Earth geometry and D3 code; it makes no remote tile or video requests.

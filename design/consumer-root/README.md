# Consumer root UI concepts

Open `index.html` directly in a browser, or from the repository root run:

```powershell
python -m http.server 4323 --directory design/consumer-root
```

Then open <http://localhost:4323>. Use the A/B switch in the top bar and resize the browser to compare desktop and phone layouts. “Replay intro” sketches the proposed globe-to-CDO entry motion; it is not a map implementation.

This mockup is outside `apps/consumer` and uses no API key, login, venue database, or deployment path. Map art and venue text are illustrative. Review notes and proposed dimensions live in `docs/ui-ux/consumer-foundations.md`.

## Mobile map proposal

Open `mobile.html` directly, or visit <http://localhost:4323/mobile.html> with the server above running. This separate mock shows a compact three-button filter row, an Explore CDO sheet at the bottom, map tools above the bottom safe area, and a selected-cafe state. The controls are interactive for review; all map and cafe content is illustrative.

## Real MapLibre globe intro

Visit <http://localhost:4323/globe-maplibre.html> with the same server running. This standalone graphics mock uses MapLibre GL JS, a public global vector style, globe projection, sky atmosphere, and a camera flight into Cagayan de Oro. Replay and Skip are interactive. It requires internet access and WebGL; it does not use the app's CDO-only PMTiles, API keys, venue data, or production route. The final map and UI after the flight are illustrative.

## Video startup benchmark

Visit <http://localhost:4323/intro-app-trial.html?intro=1> to review the current illustrated intro in an isolated local page. The previous recorded MapLibre sample remains at <http://localhost:4323/intro-video-benchmark.html> for comparison; it is no longer used by the consumer page. Measurements and test conditions for that experiment are in `docs/ui-ux/intro-performance.md`.

The current globe uses [Natural Earth 110m land geometry](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson), retained here as `ne_110m_land.geojson`. The app shows a projected 39 KB SVG poster, rotates local vector geometry until CDO faces forward, then zooms into it. No remote tiles or video are used.

The app's local renderer includes D3 Array 3.2.4 and D3 Geo 3.1.1 with their license files in `apps/consumer/public/intro`.

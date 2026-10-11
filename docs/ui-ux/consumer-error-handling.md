# Consumer error handling

Status: local implementation for review, 12 October 2026.

## Rule

Show visitors the outcome and a useful next action. Never render `String(error)`, exception messages, stacks, module URLs, raw server response bodies, or library errors. Keep raw details in development logs or internal diagnostics. The client only displays API error text found in `publicApiMessage`'s exact allowlist; unknown text becomes feature-specific fallback copy.

## Visible error inventory

| Area | Failure types | Visitor-facing behavior |
| --- | --- | --- |
| 3D walkthrough | Engine module download/start, missing WebGL support, GPU/context loss | Friendly viewer message with Try again; unsupported devices use the cafe page's existing guidance. |
| Scan content | Full scan download/parse/render failure, missing preview, full detail failure after preview | Friendly scan message with Try again; if the preview rendered, keep it and show a short full-detail note. |
| Map and discovery | Venue API/network failure, basemap/tile failure, global globe intro failure | Venue fetch shows a reload prompt. Globe intro skips to the local map after failure or a short timeout. Map tile details stay out of the UI. |
| Saved cafes | Venue list or account sync failure | Saved page shows a reload prompt; local saves remain usable. |
| Reviews | Invalid rating/text, signed-out user, duplicate review, save/edit/delete failure | Specific approved guidance, otherwise a generic retry message; draft remains on device. |
| Review photos | Unsupported/undecodable file, size limit, timeout, network/upload failure | Review stays saved; a specific safe reason or retry prompt appears. |
| Scan request | Rate limit, unknown/already-scanned cafe, network/server failure | Approved short guidance or a generic retry message. |
| Sign-in | Google start, callback, unavailable accounts | Login page maps known error codes to fixed copy. |
| Location and sharing | Location denied/unavailable, share/copy failure | Location prompt or a copyable share link; no browser exception text. |
| Server page render | Unexpected error in an on-demand Astro page | Standalone `500.astro` page with a retry suggestion and home link. |

## Development-only details and limits

- `/lab` walkthrough diagnostics show browser error details in local development only. A production build keeps those details out of its visible panel and copied summary.
- Vite's development error overlay and browser console can still show technical details locally. They are developer tools, not the production UI.
- The `500.astro` page covers Astro on-demand page rendering. A failure before Astro runs, or at the hosting layer, may use Cloudflare's own error response. Prerendered pages cannot use Astro's custom 500 page.
- The current globe uses OpenFreeMap global vector tiles. If that service is unavailable, visitors go directly to the CDO map. Validate on slower mobile devices before deployment.

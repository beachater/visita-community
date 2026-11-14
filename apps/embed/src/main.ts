import { listingUrl, loadVenue, venueSlug, VenueLoadError, type EmbedConfig } from "./venue";
import { startViewer, type ViewerEvent } from "./viewer";

// Embed widget (PRD 5.4): one venue's walkthrough plus a "Powered by Visita"
// backlink, nothing else. Usage on a cafe's own site:
//   <iframe src="https://<embed host>/?venue=<slug>" allow="fullscreen"></iframe>

const config: EmbedConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  assetsBaseUrl: import.meta.env.VITE_ASSETS_BASE_URL,
  siteUrl: import.meta.env.VITE_SITE_URL,
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("viewer");
const badge = $<HTMLAnchorElement>("badge");
const status = $<HTMLDivElement>("status");
const statusText = $<HTMLParagraphElement>("status-text");
const statusDetail = $<HTMLParagraphElement>("status-detail");
const retry = $<HTMLButtonElement>("retry");
const pill = $<HTMLDivElement>("pill");
const joyBase = $<HTMLDivElement>("joy-base");
const joyStick = $<HTMLDivElement>("joy-stick");

const MB = 1024 * 1024;
const mb = (bytes: number) => (bytes / MB).toFixed(1);

function showStatus(text: string, detail = "", canRetry = false) {
  status.hidden = false;
  statusText.textContent = text;
  statusDetail.textContent = detail;
  retry.hidden = !canRetry;
}

function bytes(received: number, total: number | null): string {
  if (total) return `${Math.round((received / total) * 100)}% · ${mb(received)} of ${mb(total)} MB`;
  return received > 0 ? `${mb(received)} MB` : "";
}

const placeJoystick = (el: HTMLElement, [x, y]: [number, number]) => {
  el.hidden = false;
  el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
};

function onViewerEvent(event: ViewerEvent) {
  switch (event.type) {
    case "progress":
      return showStatus(event.label, bytes(event.received, event.total));
    case "preparing":
      return showStatus("Setting up the room");
    case "first-view":
      status.hidden = true;
      if (event.preview) {
        pill.hidden = false;
        pill.textContent = "Preview · loading full detail";
      }
      return;
    case "detail-progress":
      pill.textContent = event.total
        ? `Preview · loading full detail ${mb(event.received)} of ${mb(event.total)} MB`
        : "Preview · loading full detail";
      return;
    case "detail-failed":
      pill.textContent = "Showing a preview. Full detail didn't load.";
      return;
    case "complete":
      pill.hidden = true;
      return;
    case "error":
      pill.hidden = true;
      return showStatus(event.message, "", true);
    case "joystick":
      placeJoystick(joyBase, event.base);
      placeJoystick(joyStick, event.stick);
      return;
    case "joystick-end":
      joyBase.hidden = true;
      joyStick.hidden = true;
      return;
  }
}

function supportsWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

const isMobile = /iPhone|iPad|iPod|Android|Mobi/.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
let stop: (() => void) | null = null;

async function run(slug: string) {
  stop?.();
  stop = null;
  pill.hidden = true;
  showStatus("Starting the viewer");

  let venue;
  try {
    venue = await loadVenue(config, slug);
  } catch (err) {
    if (!(err instanceof VenueLoadError)) throw err;
    return showStatus("The walkthrough didn't load. Check your connection and try again.", "", true);
  }
  if (!venue) return showStatus("This walkthrough isn't available.", "It may have been unpublished.");

  document.title = `${venue.name} · 3D walkthrough · Visita`;
  canvas.setAttribute("aria-label", `3D walkthrough of ${venue.name}. Use the left side to move and the right side to look around.`);
  badge.setAttribute("aria-label", `See ${venue.name} on Visita`);

  stop = startViewer({
    canvas,
    src: venue.src,
    previewSrc: venue.previewSrc,
    experience: venue.experience,
    maxPixelRatio: isMobile ? 1 : 1.5,
    onEvent: onViewerEvent,
  });
}

const slug = venueSlug(location.search);
badge.href = listingUrl(config.siteUrl, slug);

if (!slug) {
  showStatus("No cafe selected.", "Add ?venue=<slug> to the embed URL.");
} else if (!supportsWebGL2()) {
  showStatus("This browser can't show 3D walkthroughs.", "Open the cafe on Visita instead.");
} else {
  retry.addEventListener("click", () => void run(slug));
  void run(slug);
}

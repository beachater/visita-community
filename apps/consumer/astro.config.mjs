// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";

// Server output by default; pages that are the same for every visitor opt in
// with `export const prerender = true` (PRD 5.2). Every page declares its mode
// explicitly so it can be grepped.
export default defineConfig({
  site: "https://visita.ph",
  output: "server",
  // Clean share URLs (/cafe/sonnys), the same for prerendered and server routes.
  trailingSlash: "never",
  build: { format: "file" },
  // Auth lives in Supabase cookies, so Astro sessions (and the KV namespace
  // they'd need) are off. Images are optimized at build time, so there's no
  // runtime Cloudflare Images binding to pay for ($0 budget, PRD 5.8).
  session: false,
  adapter: cloudflare({ imageService: "compile" }),
  integrations: [react()],
});

// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

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
  vite: {
    plugins: [tailwindcss()],
    // Dev only. The Cloudflare adapter adds these to the server environment's
    // pre-bundle too. Without them Vite finds them mid-session (the linked
    // @visita/* packages aren't pre-bundled, so their imports surface late),
    // re-optimizes, and the running worker asks for files under the old hash:
    // "The file does not exist at .../deps_ssr/astro_app_entrypoint_dev.js".
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "@supabase/ssr",
        "@supabase/supabase-js",
        "@nanostores/react",
        "nanostores",
        "lucide-react",
        "radix-ui",
        "class-variance-authority",
        "clsx",
        "tailwind-merge",
        "sonner",
        "playcanvas",
        "playcanvas/scripts/esm/camera-controls.mjs",
      ],
    },
  },
});

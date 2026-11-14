// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { TIER3_ENABLED, TIER3_ROUTES } from "./src/tier3/routes.mjs";

// This app has no Node types (it runs on Workers), so the config reaches Node
// through this typed view of `process`.
/**
 * @typedef {{ status: number | null }} SpawnResult
 * @typedef {{ spawnSync(cmd: string, args: string[], opts: object): SpawnResult }} ChildProcess
 * @typedef {{ argv: string[], getBuiltinModule(id: "node:child_process"): ChildProcess }} NodeProcess
 */
const process = /** @type {{ process: NodeProcess }} */ (/** @type {unknown} */ (globalThis)).process;

// Remote bindings (the real ASSETS_BUCKET, see wrangler.jsonc) need Wrangler
// auth: a `wrangler login` or CLOUDFLARE_API_TOKEN. `astro dev` and logged-in
// builds keep them. A build with no auth turns them off instead of failing in
// the prerender step. No prerendered page reads R2, so the output is the same.
// `wrangler auth token` is Wrangler's own check (env token, login, profiles,
// keyring). Its output, the token, is discarded.
function hasCloudflareAuth() {
  const { spawnSync } = process.getBuiltinModule("node:child_process");
  const result = spawnSync("wrangler", ["auth", "token"], { stdio: "ignore", timeout: 30_000 });
  return result.status === 0;
}

const isBuild = process.argv.includes("build");
const remoteBindings = !isBuild || hasCloudflareAuth();
if (!remoteBindings) {
  console.warn("[visita] No Cloudflare auth found, so this build runs without remote bindings.");
}

// Server output by default; pages that are the same for every visitor opt in
// with `export const prerender = true` (PRD 5.2). Every page declares its mode
// explicitly so it can be grepped.
export default defineConfig({
  site: "https://visita.today",
  output: "server",
  // Clean share URLs (/cafe/sonnys), the same for prerendered and server routes.
  trailingSlash: "never",
  build: { format: "file" },
  // Auth lives in Supabase cookies, so Astro sessions (and the KV namespace
  // they'd need) are off. Images are optimized at build time, so there's no
  // runtime Cloudflare Images binding to pay for ($0 budget, PRD 5.8).
  session: false,
  adapter: cloudflare({ imageService: "compile", remoteBindings }),
  integrations: [react(), tier3Routes()],
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

// Injects the Tier 3 pages only while they're switched on (see src/tier3/routes.mjs).
/** @returns {import("astro").AstroIntegration} */
function tier3Routes() {
  return {
    name: "visita:tier3-routes",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
        if (!TIER3_ENABLED) return;
        for (const route of TIER3_ROUTES) injectRoute(route);
      },
    },
  };
}

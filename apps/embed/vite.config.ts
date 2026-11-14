import { defineConfig, loadEnv, type Plugin } from "vite";
import { embedHeaders, headersFile } from "./src/headers.ts";

// Static build for Cloudflare Pages (PRD 5.4). The same headers apply to the
// dev server, so a local third-party test page sees the deployed CSP.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_ASSETS_BASE_URL", "VITE_SITE_URL"]) {
    if (!env[name]) throw new Error(`apps/embed: ${name} is not set (see .env)`);
  }
  const headers = embedHeaders({ supabaseUrl: env.VITE_SUPABASE_URL!, assetsBaseUrl: env.VITE_ASSETS_BASE_URL! });

  const pagesHeaders: Plugin = {
    name: "visita-embed-headers",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: headersFile(headers) });
    },
  };

  return {
    plugins: [pagesHeaders],
    server: { headers },
    preview: { headers },
    build: { target: "es2022" },
  };
});

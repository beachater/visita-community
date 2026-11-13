import { describe, expect, it } from "vitest";
import { embedHeaders, headersFile } from "./headers";

const headers = embedHeaders({
  supabaseUrl: "https://example.supabase.co",
  assetsBaseUrl: "https://visita.ph/assets",
});
const csp = headers["Content-Security-Policy"]!;

describe("embedHeaders", () => {
  it("lets any site frame the widget", () => {
    expect(csp).toContain("frame-ancestors *");
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("x-frame-options");
  });
  it("only connects to Supabase and the assets origin", () => {
    expect(csp).toContain("connect-src 'self' https://example.supabase.co https://visita.ph;");
  });
  it("writes a Cloudflare Pages _headers file", () => {
    const file = headersFile(headers);
    expect(file).toMatch(/^\/\*$/m);
    expect(file).toContain("  Content-Security-Policy: default-src 'self'; frame-ancestors *;");
    expect(file).toContain("/assets/*\n  Cache-Control: public, max-age=31536000, immutable");
  });
});

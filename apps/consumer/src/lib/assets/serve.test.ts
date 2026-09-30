import { describe, expect, it } from "vitest";
import { assetHeaders, isServableKey } from "./serve";

const object = { size: 10_686_607, httpEtag: '"abc"', contentType: "application/vnd.pmtiles", cacheControl: "public, max-age=31536000, immutable" };

describe("isServableKey", () => {
  it.each(["splats/sonnys/v1.sog", "splats/sonnys/v1/lod-meta.json", "basemaps/cdo-20260927.pmtiles", "reviews/bbbbbbbb-0000/11112222.jpg"])("serves %s", (k) =>
    expect(isServableKey(k)).toBe(true),
  );
  it.each(["", "secrets/owner-proof.jpg", "../splats/x", "splats/../proofs/a.jpg", "basemaps//x"])("refuses %s", (k) =>
    expect(isServableKey(k)).toBe(false),
  );
});

describe("assetHeaders", () => {
  it("describes a whole file", () => {
    const { status, headers } = assetHeaders(object, null);
    expect(status).toBe(200);
    expect(headers.get("content-length")).toBe("10686607");
    expect(headers.get("accept-ranges")).toBe("bytes");
    expect(headers.get("etag")).toBe('"abc"');
    expect(headers.get("content-type")).toBe("application/vnd.pmtiles");
    expect(headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });
  it("describes a byte range as 206 with Content-Range", () => {
    const { status, headers } = assetHeaders(object, { offset: 0, length: 127 });
    expect(status).toBe(206);
    expect(headers.get("content-range")).toBe("bytes 0-126/10686607");
    expect(headers.get("content-length")).toBe("127");
  });
  it("lets other sites read assets (the embed widget runs on cafe websites)", () => {
    const { headers } = assetHeaders(object, null);
    expect(headers.get("access-control-allow-origin")).toBe("*");
    expect(headers.get("access-control-expose-headers")).toMatch(/Content-Range/);
  });
  it("falls back to a safe type and a short cache when metadata is missing", () => {
    const { headers } = assetHeaders({ size: 5, httpEtag: '"x"' }, null);
    expect(headers.get("content-type")).toBe("application/octet-stream");
    expect(headers.get("cache-control")).toBe("public, max-age=3600");
  });
});

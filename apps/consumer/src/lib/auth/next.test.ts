import { describe, expect, it } from "vitest";
import { safeNext } from "./next";

describe("safeNext", () => {
  it.each([
    ["/saved", "/saved"],
    ["/cafe/sonnys?from=map#top", "/cafe/sonnys?from=map#top"],
  ])("keeps the same-site path %s", (input, out) => expect(safeNext(input)).toBe(out));

  it.each<[string | null, string]>([
    [null, "no value"],
    ["", "empty"],
    ["https://evil.example/", "absolute URL"],
    ["//evil.example/", "protocol-relative URL"],
    ["/\\evil.example", "backslash trick"],
    ["javascript:alert(1)", "script URL"],
    ["saved", "relative path"],
    ["/%2F%2Fevil.example", "encoded slashes still resolve on this site"],
  ])("falls back to home for %j (%s)", (input) => {
    const out = safeNext(input);
    expect(new URL(out, "https://visita.ph").origin).toBe("https://visita.ph");
    if (input !== "/%2F%2Fevil.example") expect(out).toBe("/");
  });

  it("never sends people back to the auth pages", () => expect(safeNext("/auth/logout")).toBe("/"));
});

import { describe, expect, it } from "vitest";
import { networkKey, parseDemandBody } from "./demand";

describe("parseDemandBody", () => {
  it("accepts a venue slug and device id", () =>
    expect(parseDemandBody({ slug: "gaston-park", deviceId: "k3v9x0aZ-b7_Qw12" })).toEqual({ ok: true, slug: "gaston-park", deviceId: "k3v9x0aZ-b7_Qw12" }));
  it.each<[unknown, string]>([
    [null, "no body"],
    [{}, "missing fields"],
    [{ slug: "gaston-park" }, "missing device"],
    [{ slug: "Gaston Park!", deviceId: "k3v9x0aZ-b7_Qw12" }, "bad slug"],
    [{ slug: "gaston-park", deviceId: "short" }, "short device id"],
    [{ slug: "gaston-park", deviceId: "has spaces in it!!" }, "bad device id"],
    [{ slug: "x".repeat(200), deviceId: "k3v9x0aZ-b7_Qw12" }, "overlong slug"],
  ])("rejects %j (%s)", (body) => expect(parseDemandBody(body).ok).toBe(false));
});

describe("networkKey", () => {
  it("is the same for one network on one Manila day", async () =>
    expect(await networkKey("secret", "203.0.113.9", new Date("2026-10-01T01:00:00Z"))).toBe(await networkKey("secret", "203.0.113.9", new Date("2026-10-01T15:00:00Z"))));
  it("changes the next day, so it can't track anyone over time", async () =>
    expect(await networkKey("secret", "203.0.113.9", new Date("2026-10-01T01:00:00Z"))).not.toBe(await networkKey("secret", "203.0.113.9", new Date("2026-10-02T01:00:00Z"))));
  it("never contains the address itself", async () => expect(await networkKey("secret", "203.0.113.9", new Date())).not.toContain("203.0.113.9"));
  it("depends on the server secret", async () =>
    expect(await networkKey("a", "203.0.113.9", new Date("2026-10-01T01:00:00Z"))).not.toBe(await networkKey("b", "203.0.113.9", new Date("2026-10-01T01:00:00Z"))));
});

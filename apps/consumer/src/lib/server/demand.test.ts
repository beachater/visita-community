import { describe, expect, it } from "vitest";
import { parseDemandBody } from "./demand";

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

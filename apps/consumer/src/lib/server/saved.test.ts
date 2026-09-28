import { describe, expect, it } from "vitest";
import { isJsonRequest, parseSavedBody } from "./saved";

describe("parseSavedBody", () => {
  it("accepts a single slug", () => expect(parseSavedBody({ slug: "sonnys" })).toEqual({ ok: true, slugs: ["sonnys"] }));
  it("accepts a list of slugs to merge, deduped", () =>
    expect(parseSavedBody({ slugs: ["litos", "sonnys", "litos"] })).toEqual({ ok: true, slugs: ["litos", "sonnys"] }));
  it.each<[unknown, string]>([
    [null, "no body"],
    [{}, "no slug"],
    [{ slug: "Not A Slug" }, "bad slug"],
    [{ slugs: "sonnys" }, "slugs not a list"],
    [{ slugs: ["ok", 3] }, "non-string in list"],
    [{ slugs: [] }, "empty list"],
    [{ slugs: Array.from({ length: 201 }, (_, i) => `c${i}`) }, "too many"],
  ])("rejects %j (%s)", (body) => expect(parseSavedBody(body).ok).toBe(false));
});

describe("isJsonRequest", () => {
  it.each([
    ["application/json", true],
    ["application/json; charset=utf-8", true],
    ["text/plain", false],
    ["application/x-www-form-urlencoded", false],
    [null, false],
  ])("%j → %s", (type, expected) => {
    const headers = new Headers(type ? { "content-type": type } : {});
    expect(isJsonRequest(new Request("https://visita.ph/api/saved", { method: "POST", headers }))).toBe(expected);
  });
});

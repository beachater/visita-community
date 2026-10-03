import { describe, expect, it } from "vitest";
import { cafePath } from "./load";

describe("cafePath", () => {
  it("asks for one published cafe by slug", () => {
    const p = cafePath("gaston-park");
    expect(p).toContain("slug=eq.gaston-park");
    expect(p).toContain("is_published=eq.true");
    expect(p).toContain("limit=1");
  });
  it.each(["", "Bad Slug", "a,b", "x)or(1=1", "../venues"])("refuses %j before querying", (s) => expect(cafePath(s)).toBeNull());
});

import { describe, expect, it } from "vitest";
import { parseReviewInput } from "./input";

describe("parseReviewInput", () => {
  it("accepts a rating with text, trimmed", () =>
    expect(parseReviewInput({ slug: "sonnys", rating: 4, body: "  Quiet, good outlets \n" })).toEqual({
      ok: true,
      value: { slug: "sonnys", rating: 4, body: "Quiet, good outlets" },
    }));
  it("treats blank text as no text", () =>
    expect(parseReviewInput({ slug: "sonnys", rating: 5, body: "   " })).toEqual({ ok: true, value: { slug: "sonnys", rating: 5, body: null } }));
  it("allows a rating on its own", () =>
    expect(parseReviewInput({ slug: "sonnys", rating: 1 })).toEqual({ ok: true, value: { slug: "sonnys", rating: 1, body: null } }));
  it.each<[unknown, string]>([
    [null, "no body"],
    [{ rating: 4 }, "no cafe"],
    [{ slug: "sonnys" }, "no rating"],
    [{ slug: "sonnys", rating: 0 }, "rating too low"],
    [{ slug: "sonnys", rating: 6 }, "rating too high"],
    [{ slug: "sonnys", rating: 3.5 }, "half stars"],
    [{ slug: "sonnys", rating: "4" }, "rating as text"],
    [{ slug: "sonnys", rating: 4, body: 42 }, "text not a string"],
    [{ slug: "sonnys", rating: 4, body: "x".repeat(5001) }, "text over 5000 characters"],
  ])("rejects %j (%s)", (input) => expect(parseReviewInput(input).ok).toBe(false));
});

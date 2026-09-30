import { describe, expect, it } from "vitest";
import { ratingSummary } from "./summary";

describe("ratingSummary", () => {
  it("averages to one decimal", () => expect(ratingSummary([5, 4, 4])).toEqual({ average: 4.3, count: 3 }));
  it("has no average without reviews", () => expect(ratingSummary([])).toEqual({ average: null, count: 0 }));
});

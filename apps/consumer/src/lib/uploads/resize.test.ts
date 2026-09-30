import { describe, expect, it } from "vitest";
import { fitWithin } from "./resize";

describe("fitWithin", () => {
  it("shrinks a landscape photo to 1600 wide", () => expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 }));
  it("shrinks a portrait photo to 1600 tall", () => expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 }));
  it("never enlarges a small photo", () => expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 }));
  it("rounds to whole pixels", () => expect(fitWithin(3000, 1999)).toEqual({ width: 1600, height: 1066 }));
});

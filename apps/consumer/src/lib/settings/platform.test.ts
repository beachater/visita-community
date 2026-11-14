import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "./platform";

describe("parseSettings", () => {
  it("reads the flag when it's on", () => expect(parseSettings([{ in_app_directions: true }])).toEqual({ inAppDirections: true }));
  it("reads the flag when it's off", () => expect(parseSettings([{ in_app_directions: false }])).toEqual({ inAppDirections: false }));
  it("treats a missing row as everything off", () => expect(parseSettings([])).toEqual(DEFAULT_SETTINGS));
  it("treats an error body as everything off", () => expect(parseSettings({ message: "relation does not exist" })).toEqual(DEFAULT_SETTINGS));
  it("only turns on for a real true", () => expect(parseSettings([{ in_app_directions: "true" }])).toEqual(DEFAULT_SETTINGS));
});

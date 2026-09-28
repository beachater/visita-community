import { describe, expect, it } from "vitest";
import { hasAuthCookie, mergeSaved, savedToUpload } from "./merge";

describe("mergeSaved", () => {
  it("keeps the device list first, then account-only cafes", () =>
    expect(mergeSaved(["b", "a"], ["a", "c", "d"])).toEqual(["b", "a", "c", "d"]));
  it("returns the account list when the device has nothing", () => expect(mergeSaved([], ["x", "y"])).toEqual(["x", "y"]));
  it("returns the device list when the account has nothing", () => expect(mergeSaved(["x"], [])).toEqual(["x"]));
  it("drops duplicates within either list", () => expect(mergeSaved(["a", "a"], ["b", "b", "a"])).toEqual(["a", "b"]));
});

describe("savedToUpload", () => {
  it("lists device saves the account doesn't have yet", () => expect(savedToUpload(["b", "a", "c"], ["a"])).toEqual(["b", "c"]));
  it("is empty when the account already has everything", () => expect(savedToUpload(["a"], ["a", "b"])).toEqual([]));
});

describe("hasAuthCookie", () => {
  it.each([
    ["sb-127-auth-token=base64-abc", true],
    ["visita_consent=1; sb-abcdefgh-auth-token.0=base64-abc; sb-abcdefgh-auth-token.1=def", true],
    ["", false],
    ["visita_consent=1", false],
    ["sb-127-auth-token-code-verifier=xyz", false],
  ])("%j → %s", (cookie, expected) => expect(hasAuthCookie(cookie)).toBe(expected));
});

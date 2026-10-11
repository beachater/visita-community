import { describe, expect, it } from "vitest";
import { publicApiMessage } from "./public-message";

describe("publicApiMessage", () => {
  it("keeps deliberate guidance", () => {
    expect(publicApiMessage("Too many requests. Try again in a minute.", "Fallback")).toBe("Too many requests. Try again in a minute.");
  });

  it("does not render unknown errors, URLs, or non-string payloads", () => {
    const fallback = "Please try again.";
    expect(publicApiMessage("TypeError: Failed to fetch dynamically imported module: http://localhost:4321/playcanvas.js", fallback)).toBe(fallback);
    expect(publicApiMessage({ stack: "internal" }, fallback)).toBe(fallback);
  });
});

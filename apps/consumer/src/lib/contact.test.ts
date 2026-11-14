import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL, PRIVACY_EMAIL, mailto } from "./contact";

describe("contact", () => {
  it("uses the visita.today domain", () => {
    expect(CONTACT_EMAIL).toBe("hello@visita.today");
    expect(PRIVACY_EMAIL).toBe("privacy@visita.today");
  });

  it("builds mailto links, encoding the subject", () => {
    expect(mailto(CONTACT_EMAIL)).toBe("mailto:hello@visita.today");
    expect(mailto(CONTACT_EMAIL, "Cafe listing")).toBe("mailto:hello@visita.today?subject=Cafe%20listing");
  });
});

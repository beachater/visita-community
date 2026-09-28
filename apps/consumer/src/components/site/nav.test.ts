import { describe, expect, it } from "vitest";
import { isCurrent, loginHref, pagePath } from "./nav";

describe("pagePath", () => {
  it.each([
    ["/cafe/sonnys.html", "/cafe/sonnys"],
    ["/index.html", "/"],
    ["/explore", "/explore"],
    ["/saved/", "/saved"],
  ])("%s → %s", (input, out) => expect(pagePath(input)).toBe(out));
});

describe("loginHref", () => {
  it("brings people back to the page they were on", () => expect(loginHref("/cafe/sonnys")).toBe("/auth/login?next=%2Fcafe%2Fsonnys"));
  it("needs no return path from the home page", () => expect(loginHref("/")).toBe("/auth/login"));
});

describe("isCurrent", () => {
  it("matches a section and its pages", () => expect(isCurrent("/explore", "/explore.html")).toBe(true));
});

import { describe, expect, it } from "vitest";
import { photoFailureMessage } from "./photo-errors";

describe("photoFailureMessage", () => {
  it("says the format is the problem when the phone can't read the photo", () =>
    expect(photoFailureMessage({ kind: "decode" })).toMatch(/can't be read.*JPEG or PNG/));
  it("says it timed out, and how to retry", () => expect(photoFailureMessage({ kind: "timeout" })).toMatch(/timed out.*Try the photo again/));
  it("points at the connection for a network failure", () => expect(photoFailureMessage({ kind: "network" })).toMatch(/connection/));
  it("passes the server's reason through", () => expect(photoFailureMessage({ kind: "server", message: "Photos can be up to 8 MB." })).toMatch(/up to 8 MB/));
  it("always says the review itself is saved", () =>
    (["decode", "timeout", "network"] as const).forEach((kind) => expect(photoFailureMessage({ kind })).toMatch(/^Your review is saved/)));
});

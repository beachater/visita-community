import { describe, expect, it } from "vitest";
import { dedupeEvents, MAX_EVENTS, parseTrackBody } from "./track";

const V = "aaaaaaaa-0000-4000-8000-000000000001";
const body = (over: Record<string, unknown> = {}) => ({
  consent: "usage",
  sessionId: "k3v9x0aZ-b7_Qw12abcd",
  events: [{ type: "profile_view", venueId: V, props: { filters: ["wifi", "price"] } }],
  ...over,
});

describe("parseTrackBody", () => {
  it("accepts a consented batch", () =>
    expect(parseTrackBody(body())).toEqual({
      ok: true,
      sessionId: "k3v9x0aZ-b7_Qw12abcd",
      events: [{ type: "profile_view", venueId: V, props: { filters: ["wifi", "price"] } }],
    }));
  it("refuses a batch without the consent marker", () => expect(parseTrackBody(body({ consent: undefined }))).toMatchObject({ ok: false, status: 403 }));
  it("refuses unknown event types", () =>
    expect(parseTrackBody(body({ events: [{ type: "page_scroll", venueId: V }] }))).toMatchObject({ ok: false, status: 400 }));
  it("refuses a bad venue id", () => expect(parseTrackBody(body({ events: [{ type: "profile_view", venueId: "x" }] }))).toMatchObject({ ok: false, status: 400 }));
  it("refuses a bad session id", () => expect(parseTrackBody(body({ sessionId: "short" }))).toMatchObject({ ok: false, status: 400 }));
  it("refuses an empty or oversized batch", () => {
    expect(parseTrackBody(body({ events: [] }))).toMatchObject({ ok: false, status: 400 });
    expect(parseTrackBody(body({ events: Array.from({ length: MAX_EVENTS + 1 }, () => ({ type: "profile_view", venueId: V })) }))).toMatchObject({ ok: false, status: 413 });
  });
  it("keeps only known filter names, and only on events that carry them", () =>
    expect(
      parseTrackBody(
        body({
          events: [
            { type: "profile_view", venueId: V, props: { filters: ["wifi", "<script>", "wifi"], email: "a@b.c" } },
            { type: "directions_tap", venueId: V, props: { filters: ["wifi"] } },
          ],
        }),
      ),
    ).toMatchObject({ ok: true, events: [{ props: { filters: ["wifi"] } }, { props: {} }] }));
  it("refuses a body that isn't an object", () => expect(parseTrackBody("nope")).toMatchObject({ ok: false, status: 400 }));
});

describe("dedupeEvents", () => {
  const W = "aaaaaaaa-0000-4000-8000-000000000002";
  const e = (type: "profile_view" | "directions_tap", venueId = V) => ({ type, venueId, props: {} });
  it("keeps one event per venue and type in a batch", () =>
    expect(dedupeEvents([e("profile_view"), e("profile_view"), e("directions_tap"), e("profile_view", W)], 10)).toHaveLength(3));
  it("caps events per venue", () => expect(dedupeEvents([e("profile_view"), e("directions_tap")], 1)).toHaveLength(1));
});

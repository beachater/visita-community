import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTracker } from "./track";

const V = "aaaaaaaa-0000-4000-8000-000000000001";

function setup(consent = true) {
  const state = { consent };
  const beacon = vi.fn((_url: string, _data: Blob) => true);
  const post = vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }));
  const tracker = createTracker({ consent: () => state.consent, sessionId: () => "sess-aaaaaaaaaaaaaaaa", sendBeacon: beacon, fetch: post, delayMs: 1000, maxBatch: 3 });
  const bodies = () => post.mock.calls.map(([, init]) => JSON.parse(String(init.body)));
  return { state, beacon, post, tracker, bodies };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createTracker", () => {
  it("records nothing without consent", async () => {
    const t = setup(false);
    t.tracker.track("profile_view", V);
    await vi.runAllTimersAsync();
    t.tracker.flush(true);
    expect(t.post).not.toHaveBeenCalled();
    expect(t.beacon).not.toHaveBeenCalled();
  });

  it("batches events into one request after a short delay", async () => {
    const t = setup();
    t.tracker.track("profile_view", V);
    t.tracker.track("walkthrough_open", V);
    expect(t.post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.post).toHaveBeenCalledTimes(1);
    expect(t.bodies()[0]).toEqual({
      consent: "usage",
      sessionId: "sess-aaaaaaaaaaaaaaaa",
      events: [
        { type: "profile_view", venueId: V, props: {} },
        { type: "walkthrough_open", venueId: V, props: {} },
      ],
    });
    expect(t.post.mock.calls[0]![1].keepalive).toBe(true);
  });

  it("sends at once when a batch fills up", () => {
    const t = setup();
    for (let i = 0; i < 3; i++) t.tracker.track("search_appearance", V);
    expect(t.post).toHaveBeenCalledTimes(1);
  });

  it("uses a beacon when the page is being hidden", () => {
    const t = setup();
    t.tracker.track("directions_tap", V);
    t.tracker.flush(true);
    expect(t.beacon).toHaveBeenCalledTimes(1);
    expect(t.post).not.toHaveBeenCalled();
  });

  it("falls back to fetch when the beacon is refused", () => {
    const t = setup();
    t.beacon.mockReturnValueOnce(false);
    t.tracker.track("directions_tap", V);
    t.tracker.flush(true);
    expect(t.post).toHaveBeenCalledTimes(1);
  });

  it("drops what's queued if consent is withdrawn before sending", async () => {
    const t = setup();
    t.tracker.track("profile_view", V);
    t.state.consent = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.post).not.toHaveBeenCalled();
  });

  it("never sends the same event twice", async () => {
    const t = setup();
    t.tracker.track("profile_view", V);
    await vi.advanceTimersByTimeAsync(1000);
    t.tracker.flush(true);
    expect(t.post).toHaveBeenCalledTimes(1);
    expect(t.beacon).not.toHaveBeenCalled();
  });
});

import { getDeviceId } from "../visitor/device";
import { markDemanded } from "../visitor/stores";

export type DemandOutcome = { ok: true } | { ok: false; message: string };

/** Sends "I want to see inside" for an unscanned cafe. */
export async function requestScan(slug: string): Promise<DemandOutcome> {
  try {
    const res = await fetch("/api/demand", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, deviceId: getDeviceId() }),
    });
    if (res.ok) {
      markDemanded(slug);
      return { ok: true };
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, message: body.error ?? "Couldn't send your request. Try again later." };
  } catch {
    return { ok: false, message: "You seem to be offline. Try again when you're connected." };
  }
}

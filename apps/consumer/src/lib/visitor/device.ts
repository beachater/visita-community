// A random id for this browser, stored on the device. Used only to count one
// "I want to see inside" per device per cafe; it isn't linked to a person.
const KEY = "visita:device";

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Storage blocked: a fresh id per visit still dedupes within the visit.
    return crypto.randomUUID();
  }
}

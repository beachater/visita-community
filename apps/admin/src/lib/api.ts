import { resizeToJpeg } from "@visita/uploads/resize";
import { eventPhotoPath, proofPath, reviewPhotoPath } from "./proof-route";
import { PART_SIZE, type ScanKind } from "./scan-keys";
import { supabase } from "./supabase";

// Calls to this app's own Worker (owner proofs), authorised with the
// person's Supabase access token.

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Your session ended. Sign in again.");
  return data.session.access_token;
}

/** Resizes on the device, then uploads. Throws with a readable message. */
export async function uploadProof(claimId: string, file: Blob): Promise<void> {
  const jpeg = await resizeToJpeg(file);
  let res: Response;
  try {
    res = await fetch(proofPath(claimId), {
      method: "POST",
      headers: { authorization: `Bearer ${await token()}`, "content-type": "image/jpeg" },
      body: jpeg,
    });
  } catch {
    throw new Error("couldn't reach Visita; check your connection");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "The upload didn't go through. Try again.");
  }
}

/** An object URL for the proof photo; the caller revokes it. */
export async function fetchProof(claimId: string): Promise<string | null> {
  const res = await fetch(proofPath(claimId), { headers: { authorization: `Bearer ${await token()}` } });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}

/** Adds or replaces an event's photo (resized on the device), or removes it with `null`. */
export async function setEventPhoto(eventId: string, file: Blob | null): Promise<void> {
  let res: Response;
  try {
    res = await fetch(eventPhotoPath(eventId), {
      method: file ? "POST" : "DELETE",
      headers: { authorization: `Bearer ${await token()}`, ...(file ? { "content-type": "image/jpeg" } : {}) },
      body: file ? await resizeToJpeg(file) : undefined,
    });
  } catch {
    throw new Error("couldn't reach Visita; check your connection");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "The photo didn't save. Try again.");
  }
}

async function adminCall<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { authorization: `Bearer ${await token()}`, ...(init.headers ?? {}) } });
  } catch {
    throw new Error("couldn't reach Visita; check your connection");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}

/**
 * Uploads one scan file to R2 in 25 MB parts through the Worker. The Worker
 * picks the key (a new version, never an existing file). Aborts the upload if
 * any part fails, so no half-written file is left behind.
 */
export async function uploadScanFile(
  venueId: string,
  file: File,
  kind: ScanKind,
  version: number | undefined,
  onProgress: (sent: number) => void,
): Promise<{ key: string; version: number }> {
  const json = { "content-type": "application/json" };
  const start = await adminCall<{ key: string; version: number; uploadId: string }>("/api/scans/start", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ venueId, kind, version }),
  });
  const q = (extra = "") => `key=${encodeURIComponent(start.key)}&uploadId=${encodeURIComponent(start.uploadId)}${extra}`;
  try {
    const parts: { partNumber: number; etag: string }[] = [];
    for (let offset = 0, n = 1; offset < file.size || n === 1; offset += PART_SIZE, n++) {
      const chunk = file.slice(offset, offset + PART_SIZE);
      parts.push(await adminCall(`/api/scans/part?${q(`&part=${n}`)}`, { method: "PUT", body: chunk }));
      onProgress(Math.min(file.size, offset + chunk.size));
    }
    await adminCall(`/api/scans/complete?${q()}`, { method: "POST", headers: json, body: JSON.stringify({ parts }) });
    return { key: start.key, version: start.version };
  } catch (e) {
    await adminCall(`/api/scans/abort?${q()}`, { method: "POST" }).catch(() => undefined);
    throw e;
  }
}

/** Moderators remove a review's photo, deleting the file too. */
export async function removeReviewPhoto(reviewId: string): Promise<void> {
  await adminCall(reviewPhotoPath(reviewId), { method: "DELETE" });
}

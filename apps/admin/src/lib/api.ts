import { resizeToJpeg } from "@visita/uploads/resize";
import { proofPath } from "./proof-route";
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

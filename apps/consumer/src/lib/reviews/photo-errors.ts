// What to tell someone when a review photo doesn't make it (Review Focus #5):
// the review is already saved, and the next step depends on what failed.
import { publicApiMessage } from "../errors/public-message";

export type PhotoFailure = { kind: "decode" } | { kind: "timeout" } | { kind: "network" } | { kind: "server"; message?: string };

/** How long one photo upload may take before we give up and offer a retry. */
export const PHOTO_UPLOAD_TIMEOUT_MS = 60_000;

export function photoFailureMessage(f: PhotoFailure): string {
  switch (f.kind) {
    case "decode":
      return "Your review is saved, but this photo can't be read on this device. Try a JPEG or PNG photo.";
    case "timeout":
      return "Your review is saved, but the photo upload timed out. Check your connection and tap Try the photo again.";
    case "network":
      return "Your review is saved, but the photo didn't upload. Check your connection and tap Try the photo again.";
    case "server":
      return `Your review is saved, but the photo didn't upload: ${publicApiMessage(f.message, "try again")}`;
  }
}

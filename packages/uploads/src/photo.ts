// Server-side checks for review photos. The browser resizes to a 1600px JPEG
// first, but nothing from a browser is trusted: the type comes from the file's
// own bytes, never from its name or Content-Type.

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";

export type PhotoCheck = { ok: true; type: PhotoType } | { ok: false; status: 400 | 413 | 415; error: string };

const startsWith = (bytes: Uint8Array, sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);

function sniff(bytes: Uint8Array): PhotoType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** `head` is the start of the file (a dozen bytes is enough); `size` its full length. */
export function checkPhoto(head: Uint8Array, size: number): PhotoCheck {
  if (size === 0) return { ok: false, status: 400, error: "The photo is empty." };
  if (size > MAX_PHOTO_BYTES) return { ok: false, status: 413, error: "Photos can be up to 8 MB." };
  const type = sniff(head);
  if (!type) return { ok: false, status: 415, error: "That file isn't a JPEG, PNG or WebP photo." };
  return { ok: true, type };
}

const EXT: Record<PhotoType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function reviewPhotoKey(reviewId: string, id: string, type: PhotoType): string {
  return `reviews/${reviewId}/${id}.${EXT[type]}`;
}

/** Owner proof (permit photo, storefront selfie). Private: owner-proofs/ is never served publicly. */
export function ownerProofKey(claimId: string, id: string, type: PhotoType): string {
  return `owner-proofs/${claimId}/${id}.${EXT[type]}`;
}

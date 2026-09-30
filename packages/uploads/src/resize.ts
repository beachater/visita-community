// Review photos are resized on the phone before upload (PRD 5.5): a 12 MP
// camera photo becomes a ~300 KB JPEG, which matters on mobile data.

export const MAX_EDGE = 1600;

/** Scale to fit a `max` × `max` box, never enlarging. */
export function fitWithin(width: number, height: number, max = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Browser only. Decodes (respecting EXIF rotation), resizes and re-encodes as
 * JPEG. Re-encoding also drops EXIF, so a photo's GPS position never leaves
 * the phone.
 */
export async function resizeToJpeg(file: Blob, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Can't process photos in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't prepare the photo."))), "image/jpeg", quality),
  );
}

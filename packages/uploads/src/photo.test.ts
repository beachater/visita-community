import { describe, expect, it } from "vitest";
import { checkPhoto, eventPhotoKey, MAX_PHOTO_BYTES, ownerProofKey, reviewPhotoKey } from "./photo";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const TEXT = new TextEncoder().encode("<svg onload=alert(1)>");

describe("checkPhoto", () => {
  it.each([
    [JPEG, "image/jpeg"],
    [PNG, "image/png"],
    [WEBP, "image/webp"],
  ])("recognises the image from its bytes (%#)", (bytes, type) => expect(checkPhoto(bytes, bytes.length)).toEqual({ ok: true, type }));
  it("refuses something that isn't an image, whatever it claims to be", () =>
    expect(checkPhoto(TEXT, TEXT.length)).toMatchObject({ ok: false, status: 415 }));
  it("refuses a file over 8 MB", () => expect(checkPhoto(JPEG, MAX_PHOTO_BYTES + 1)).toMatchObject({ ok: false, status: 413 }));
  it("refuses an empty upload", () => expect(checkPhoto(new Uint8Array(), 0)).toMatchObject({ ok: false, status: 400 }));
});

describe("reviewPhotoKey", () => {
  it("files the photo under its review", () =>
    expect(reviewPhotoKey("bbbbbbbb-0000-0000-0000-000000000001", "11111111-2222-3333-4444-555555555555", "image/jpeg")).toBe(
      "reviews/bbbbbbbb-0000-0000-0000-000000000001/11111111-2222-3333-4444-555555555555.jpg",
    ));
  it("keeps the real file type", () => expect(reviewPhotoKey("r", "u", "image/webp")).toBe("reviews/r/u.webp"));
});

describe("ownerProofKey", () => {
  it("files proof under its claim, outside every public prefix", () =>
    expect(ownerProofKey("cccccccc-0000-0000-0000-000000000001", "u", "image/png")).toBe("owner-proofs/cccccccc-0000-0000-0000-000000000001/u.png"));
});

describe("eventPhotoKey", () => {
  it("files the photo under its event, in the public events/ prefix", () =>
    expect(eventPhotoKey("eeee", "u", "image/jpeg")).toBe("events/eeee/u.jpg"));
});

import { describe, expect, it } from "vitest";
import { bearerToken, eventPhotoId, eventPhotoPath, proofClaimId, proofPath, reviewPhotoId, reviewPhotoPath } from "./proof-route";

const ID = "cccccccc-0000-4000-8000-000000000001";

describe("proofPath / proofClaimId", () => {
  it("round-trips a claim id", () => expect(proofClaimId(proofPath(ID))).toBe(ID));
  it.each(["/api/claims/../proof", "/api/claims/not-a-uuid/proof", `/api/claims/${ID}/proof/extra`, `/api/claims/${ID}`, "/claim"])(
    "ignores %s",
    (p) => expect(proofClaimId(p)).toBeNull(),
  );
});

describe("bearerToken", () => {
  it("reads a bearer token", () => expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi"));
  it.each([null, "", "Basic abc", "Bearer ", "bearer"])("rejects %j", (h) => expect(bearerToken(h)).toBeNull());
});

describe("eventPhotoPath / eventPhotoId", () => {
  it("round-trips an event id", () => expect(eventPhotoId(eventPhotoPath(ID))).toBe(ID));
  it("doesn't confuse the two routes", () => {
    expect(eventPhotoId(proofPath(ID))).toBeNull();
    expect(proofClaimId(eventPhotoPath(ID))).toBeNull();
  });
});

describe("reviewPhotoPath / reviewPhotoId", () => {
  it("round-trips a review id", () => expect(reviewPhotoId(reviewPhotoPath(ID))).toBe(ID));
  it("doesn't match the other photo routes", () => expect(reviewPhotoId(eventPhotoPath(ID))).toBeNull());
});

// Validation for writing or editing a review (PRD 4.3). Pure, so it's tested
// without a Worker. The database checks the same limits.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_REVIEW_CHARS = 5000;

export interface ReviewInput {
  slug: string;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string | null;
}

export type ParsedReview = { ok: true; value: ReviewInput } | { ok: false; error: string };

export function parseReviewInput(input: unknown): ParsedReview {
  if (!input || typeof input !== "object") return { ok: false, error: "Expected a JSON body." };
  const { slug, rating, body } = input as Record<string, unknown>;
  if (typeof slug !== "string" || slug.length > 120 || !SLUG.test(slug)) return { ok: false, error: "Unknown cafe." };
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5)
    return { ok: false, error: "Pick a rating from 1 to 5 stars." };
  if (body !== undefined && body !== null && typeof body !== "string") return { ok: false, error: "Review text must be text." };
  const text = typeof body === "string" ? body.trim() : "";
  if (text.length > MAX_REVIEW_CHARS) return { ok: false, error: `Keep it under ${MAX_REVIEW_CHARS} characters.` };
  return { ok: true, value: { slug, rating: rating as ReviewInput["rating"], body: text || null } };
}

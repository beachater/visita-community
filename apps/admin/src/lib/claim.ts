// Client-side checks for the claim form. They mirror the database's checks on
// venue_owners so people see the problem before submitting; the database
// still has the final say.

export const PHONE = /^\+?[0-9(][0-9 ()-]{6,19}$/;

export interface ClaimDraft {
  venueId: string | null;
  newVenue: { name: string; address: string } | null;
  roleTitle: string;
  contactPhone: string;
  hasProof: boolean;
}

export type ClaimErrors = Partial<Record<"venue" | "roleTitle" | "contactPhone" | "proof", string>>;

export function validateClaim(d: ClaimDraft): ClaimErrors {
  const errors: ClaimErrors = {};
  if (!d.venueId && !d.newVenue) errors.venue = "Pick your cafe, or tell us about it if it isn't listed.";
  else if (!d.venueId && d.newVenue && !d.newVenue.name.trim()) errors.venue = "What's your cafe called?";
  if (!d.roleTitle.trim()) errors.roleTitle = "Tell us your role at the cafe.";
  if (!PHONE.test(d.contactPhone.trim())) errors.contactPhone = "Enter a number we can call, like 0917 123 4567.";
  if (!d.hasProof) errors.proof = "Add a photo of your business permit, or a selfie at the storefront.";
  return errors;
}

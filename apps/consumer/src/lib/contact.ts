// Public contact addresses (client domain: visita.today). Email is the only
// contact channel in v1.
export const CONTACT_EMAIL = "hello@visita.today";
export const PRIVACY_EMAIL = "privacy@visita.today";

/** A mailto: link, optionally with a pre-filled subject. */
export function mailto(address: string, subject?: string): string {
  return subject ? `mailto:${address}?subject=${encodeURIComponent(subject)}` : `mailto:${address}`;
}

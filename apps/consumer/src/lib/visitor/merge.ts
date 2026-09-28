// Sign-in merge for saved cafes (PRD 4.2): nothing saved on this device is
// lost, and what's already on the account comes after it.

export function mergeSaved(device: string[], account: string[]): string[] {
  return [...new Set([...device, ...account])];
}

/** Device saves to copy up to the account at sign-in. */
export function savedToUpload(device: string[], account: string[]): string[] {
  const have = new Set(account);
  return device.filter((s) => !have.has(s));
}

/**
 * Whether this browser holds a Supabase session cookie (possibly chunked as
 * `.0`, `.1`…). A hint only, so signed-out visitors skip the account request;
 * the server still checks the session.
 */
export function hasAuthCookie(cookie: string): boolean {
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(cookie);
}

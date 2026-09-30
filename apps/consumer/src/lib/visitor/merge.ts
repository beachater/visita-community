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

/**
 * What to do with saved cafes when an account answers. The first sync on a
 * device (for this account) merges the device's list into the account; after
 * that the account is the source of truth, so a cafe removed on another
 * device stays removed here instead of being uploaded again.
 */
export function planSync({
  device,
  account,
  syncedFor,
  userId,
}: {
  device: string[];
  account: string[];
  syncedFor: string | null;
  userId: string;
}): { next: string[]; upload: string[] } {
  if (syncedFor === userId) return { next: account, upload: [] };
  return { next: mergeSaved(device, account), upload: savedToUpload(device, account) };
}

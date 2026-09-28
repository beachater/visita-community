// Where to send someone after sign-in. Only paths on this site are allowed,
// so a crafted ?next= can't bounce a fresh session to another origin.

const BASE = "https://visita.invalid";

export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE || url.pathname.startsWith("/auth/")) return "/";
  return url.pathname + url.search + url.hash;
}

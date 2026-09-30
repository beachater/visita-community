// The one API route the owner app's Worker serves: an owner claim's proof
// photo. Shared by the Worker and the app so the path is defined once.

const ROUTE = /^\/api\/claims\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/proof$/i;

export const proofPath = (claimId: string) => `/api/claims/${claimId}/proof`;

export function proofClaimId(pathname: string): string | null {
  return ROUTE.exec(pathname)?.[1] ?? null;
}

export function bearerToken(header: string | null): string | null {
  const m = /^Bearer (\S+)$/.exec(header ?? "");
  return m ? m[1]! : null;
}

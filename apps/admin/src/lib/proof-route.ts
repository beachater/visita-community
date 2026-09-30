// The owner app Worker's API routes: an owner claim's proof photo, and an
// event's photo. Shared by the Worker and the app so paths are defined once.

const ROUTE = /^\/api\/claims\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/proof$/i;

export const proofPath = (claimId: string) => `/api/claims/${claimId}/proof`;

export function proofClaimId(pathname: string): string | null {
  return ROUTE.exec(pathname)?.[1] ?? null;
}

export function bearerToken(header: string | null): string | null {
  const m = /^Bearer (\S+)$/.exec(header ?? "");
  return m ? m[1]! : null;
}

const EVENT_ROUTE = /^\/api\/events\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/photo$/i;

export const eventPhotoPath = (eventId: string) => `/api/events/${eventId}/photo`;

export function eventPhotoId(pathname: string): string | null {
  return EVENT_ROUTE.exec(pathname)?.[1] ?? null;
}

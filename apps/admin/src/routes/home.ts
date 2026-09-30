// Where someone lands after signing in (PRD 4.4/4.5). This is only for
// getting around: what each person can read or change is enforced by RLS.

export interface ClaimSummary {
  id: string;
  status: "pending" | "approved" | "rejected";
  venueId: string | null;
}

export function homeFor({ isAdmin, claims }: { isAdmin: boolean; claims: ClaimSummary[] }): string {
  if (isAdmin) return "/admin/approvals";
  const owned = claims.filter((c) => c.status === "approved" && c.venueId);
  if (owned.length === 1) return `/venue/${owned[0]!.venueId}`;
  if (owned.length > 1) return "/venues";
  if (claims.length > 0) return "/status";
  return "/claim";
}

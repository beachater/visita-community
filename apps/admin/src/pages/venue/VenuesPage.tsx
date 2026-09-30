import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";

// For owners of more than one cafe: pick which dashboard to open.
export function VenuesPage() {
  const { access } = useAuth();
  const owned = (access?.claims ?? []).filter((c) => c.status === "approved" && c.venueId);
  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-display text-3xl font-bold">Your cafes</h1>
      <ul className="divide-y rounded-xl border bg-card">
        {owned.map((c) => (
          <li key={c.id}>
            <Link to={`/venue/${c.venueId}`} className="flex items-center gap-3 px-4 py-4 hover:bg-accent">
              <span className="flex-1 font-medium">{c.venueName ?? c.proposedName}</span>
              {!c.venuePublished && <span className="text-xs text-muted-foreground">Not published yet</span>}
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/status" className="w-fit text-sm underline underline-offset-2">
        Your claims
      </Link>
    </div>
  );
}

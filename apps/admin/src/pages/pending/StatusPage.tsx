import { useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { CheckCircle2, Clock, ImagePlus, XCircle } from "lucide-react";
import { Button } from "@visita/ui/button";
import { useAuth, type MyClaim } from "@/auth/AuthProvider";
import { uploadProof } from "@/lib/api";

// Where claimants wait (PRD 4.5): what's pending, what was decided and why,
// and a way to add proof if the upload didn't make it.

const date = (iso: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(new Date(iso));

function ClaimCard({ claim }: { claim: MyClaim }) {
  const { refreshAccess } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const name = claim.venueName ?? claim.proposedName ?? "Your cafe";

  const addProof = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await uploadProof(claim.id, file);
      await refreshAccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="grid gap-3 rounded-card border bg-card shadow-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{name}</h2>
          <p className="text-sm text-muted-foreground">
            {claim.roleTitle} · {claim.venueId ? "Existing listing" : "New listing"} · sent {date(claim.createdAt)}
          </p>
        </div>
        {claim.status === "pending" && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium">
            <Clock className="size-3.5" aria-hidden="true" /> Waiting for review
          </span>
        )}
        {claim.status === "approved" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/40 px-2.5 py-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> Approved
          </span>
        )}
        {claim.status === "rejected" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive">
            <XCircle className="size-3.5" aria-hidden="true" /> Not approved
          </span>
        )}
      </div>

      {claim.status === "pending" && !claim.hasProof && (
        <div className="grid gap-2 rounded-2xl bg-muted p-3 text-sm">
          <p>We can't review this claim until it has proof: a business permit photo or a storefront selfie.</p>
          <Button variant="outline" size="sm" className="w-fit" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus /> {busy ? "Uploading…" : "Add proof"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void addProof(f);
            }}
          />
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
      {claim.status === "pending" && claim.hasProof && <p className="text-sm text-muted-foreground">Proof received. We'll review it soon.</p>}
      {claim.reviewNote && (
        <p className="rounded-2xl bg-muted p-3 text-sm">
          <span className="font-medium">Note from Visita: </span>
          {claim.reviewNote}
        </p>
      )}
      {claim.status === "approved" && claim.venueId && (
        <Button asChild className="w-fit">
          <Link to={`/venue/${claim.venueId}`}>Open your dashboard</Link>
        </Button>
      )}
    </article>
  );
}

export function StatusPage() {
  const { access } = useAuth();
  const location = useLocation();
  const proofFailed = (location.state as { proofFailed?: string } | null)?.proofFailed;
  const claims = access?.claims ?? [];

  return (
    <div className="grid max-w-2xl gap-6">
      <header className="grid gap-2">
        <h1 className="font-display text-3xl font-bold">Your claims</h1>
        <p className="text-muted-foreground">We review every claim by hand and usually reply within a day or two.</p>
      </header>
      {proofFailed && (
        <p role="alert" className="rounded-lg border border-warning/50 bg-card px-4 py-3 text-sm">
          Your claim was sent, but the proof photo didn't upload ({proofFailed}). Add it below.
        </p>
      )}
      {claims.length === 0 ? (
        <p className="text-muted-foreground">You haven't claimed a cafe yet.</p>
      ) : (
        claims.map((c) => <ClaimCard key={c.id} claim={c} />)
      )}
      <Button asChild variant="outline" className="w-fit">
        <Link to="/claim">{claims.length === 0 ? "Claim your cafe" : "Claim another cafe"}</Link>
      </Button>
    </div>
  );
}

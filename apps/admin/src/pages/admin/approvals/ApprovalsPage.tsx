import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { Button } from "@visita/ui/button";
import { Label } from "@visita/ui/label";
import { Textarea } from "@visita/ui/textarea";
import { useAuth } from "@/auth/AuthProvider";
import { fetchProof } from "@/lib/api";
import { supabase } from "@/lib/supabase";

// PRD 4.5 owner approvals: the queue of pending claims, with the proof, the
// claimant's contact number, and approve or reject with a note. The database
// (review_owner_claim) enforces who may decide, including "not your own".

interface QueueItem {
  id: string;
  profileId: string;
  claimant: string;
  roleTitle: string;
  phone: string;
  venueName: string | null;
  venueAddress: string | null;
  proposed: { name?: string; address?: string } | null;
  hasProof: boolean;
  createdAt: string;
}

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(iso));

function ProofImage({ claimId, hasProof }: { claimId: string; hasProof: boolean }) {
  const [src, setSrc] = useState<string | null | undefined>(hasProof ? undefined : null);
  useEffect(() => {
    if (!hasProof) return;
    let url: string | null = null;
    let live = true;
    fetchProof(claimId).then((u) => {
      url = u;
      if (live) setSrc(u);
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [claimId, hasProof]);
  if (src === undefined) return <div className="grid h-48 place-items-center rounded-2xl bg-muted text-sm text-muted-foreground">Loading proof…</div>;
  if (src === null) return <div className="grid h-48 place-items-center rounded-2xl bg-muted text-sm text-muted-foreground">No proof uploaded yet</div>;
  return (
    <a href={src} target="_blank" rel="noopener">
      <img src={src} alt="Proof submitted with this claim" className="max-h-72 rounded-lg border object-contain" />
    </a>
  );
}

function ClaimReview({ item, own, onDone }: { item: QueueItem; own: boolean; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "approved" | "rejected") => {
    if (decision === "rejected" && !note.trim()) {
      setError("Say why, so the claimant knows what to fix.");
      return;
    }
    setError(null);
    setBusy(decision);
    const { error: rpcError } = await supabase.rpc("review_owner_claim", { p_claim_id: item.id, p_decision: decision, p_note: note });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    toast.success(decision === "approved" ? `Approved ${item.claimant}` : `Rejected ${item.claimant}'s claim`);
    onDone();
  };

  const venue = item.venueName ?? item.proposed?.name ?? "Unknown";
  return (
    <article className="grid gap-4 rounded-card border bg-card shadow-card p-5 md:grid-cols-[1fr_18rem]">
      <div className="grid content-start gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{item.venueName ? "Existing listing" : "New listing request"}</p>
          <h2 className="font-display text-xl font-semibold">{venue}</h2>
          {(item.venueAddress ?? item.proposed?.address) && <p className="text-sm text-muted-foreground">{item.venueAddress ?? item.proposed?.address}</p>}
        </div>
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Claimant</dt>
          <dd>{item.claimant}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>{item.roleTitle}</dd>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>
            <a href={`tel:${item.phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1 underline underline-offset-2">
              <Phone className="size-3.5" aria-hidden="true" /> {item.phone}
            </a>
          </dd>
          <dt className="text-muted-foreground">Sent</dt>
          <dd>{when(item.createdAt)}</dd>
        </dl>
        {own ? (
          <p className="rounded-2xl bg-muted p-3 text-sm">This is your own claim. Another admin has to review it.</p>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor={`note-${item.id}`}>Note to the claimant (required to reject)</Label>
            <Textarea id={`note-${item.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Permit checked against the storefront" />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={() => decide("approved")} disabled={busy !== null || !item.hasProof} title={item.hasProof ? undefined : "Waiting for proof"}>
                {busy === "approved" ? "Approving…" : "Approve"}
              </Button>
              <Button variant="outline" onClick={() => decide("rejected")} disabled={busy !== null}>
                {busy === "rejected" ? "Rejecting…" : "Reject"}
              </Button>
            </div>
            {!item.venueName && <p className="text-xs text-muted-foreground">Approving creates an unpublished listing the owner can fill in.</p>}
          </div>
        )}
      </div>
      <ProofImage claimId={item.id} hasProof={item.hasProof} />
    </article>
  );
}

export function ApprovalsPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from("venue_owners")
      .select(
        "id, profile_id, role_title, contact_phone, proposed_venue, proof_key, created_at, venues(name, address), profiles!venue_owners_profile_id_fkey(display_name)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (e) {
      setError("Couldn't load the queue.");
      return;
    }
    setItems(
      (data ?? []).map((r) => ({
        id: r.id,
        profileId: r.profile_id,
        claimant: r.profiles?.display_name ?? "Visita member",
        roleTitle: r.role_title,
        phone: r.contact_phone,
        venueName: r.venues?.name ?? null,
        venueAddress: r.venues?.address ?? null,
        proposed: r.proposed_venue as QueueItem["proposed"],
        hasProof: Boolean(r.proof_key),
        createdAt: r.created_at,
      })),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="font-display text-3xl font-bold">Owner approvals</h1>
        <p className="text-muted-foreground">Oldest first. Check the proof, and call the number if anything looks off.</p>
      </header>
      {error && <p role="alert">{error}</p>}
      {items === null && !error && <p className="text-muted-foreground">Loading…</p>}
      {items?.length === 0 && <p className="rounded-card border border-dashed bg-card shadow-card p-8 text-center text-muted-foreground">No claims waiting.</p>}
      {items?.map((item) => <ClaimReview key={item.id} item={item} own={item.profileId === session?.user.id} onDone={load} />)}
    </div>
  );
}

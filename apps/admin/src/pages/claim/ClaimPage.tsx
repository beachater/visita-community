import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Check, ImagePlus, Search, Store } from "lucide-react";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { Label } from "@visita/ui/label";
import { cn } from "@visita/ui/utils";
import { useAuth } from "@/auth/AuthProvider";
import { uploadProof } from "@/lib/api";
import { validateClaim, type ClaimErrors } from "@/lib/claim";
import { supabase } from "@/lib/supabase";

// PRD 4.4 owner registration: find your cafe (or tell us about it), say who
// you are, and add proof. An admin reviews the claim before anything unlocks.

interface Listing {
  id: string;
  name: string;
  address: string | null;
}

const ROLES = ["Owner", "Co-owner", "Manager"];

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

export function ClaimPage() {
  const { access, refreshAccess } = useAuth();
  const navigate = useNavigate();
  const ids = { q: useId(), name: useId(), address: useId(), role: useId(), phone: useId(), err: useId() };

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Listing[]>([]);
  const [picked, setPicked] = useState<Listing | null>(null);
  const [notListed, setNotListed] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [roleTitle, setRoleTitle] = useState("Owner");
  const [phone, setPhone] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<ClaimErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Venues this person already has an open claim on, so they aren't claimed twice.
  const openClaims = new Set((access?.claims ?? []).filter((c) => c.status !== "rejected").map((c) => c.venueId));

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const { data } = await supabase
        .from("venues")
        .select("id, name, address")
        .eq("is_published", true)
        .ilike("name", `%${q.replace(/[%_,()]/g, " ")}%`)
        .order("name")
        .limit(8);
      setResults(data ?? []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const submit = async () => {
    setSubmitError(null);
    const draft = {
      venueId: notListed ? null : (picked?.id ?? null),
      newVenue: notListed ? { name: newName, address: newAddress } : null,
      roleTitle,
      contactPhone: phone,
      hasProof: Boolean(proof),
    };
    const found = validateClaim(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("venue_owners")
        .insert({
          venue_id: draft.venueId,
          proposed_venue: draft.newVenue ? { name: draft.newVenue.name.trim(), address: draft.newVenue.address.trim() || undefined } : null,
          role_title: roleTitle.trim(),
          contact_phone: phone.trim(),
        })
        .select("id")
        .single();
      if (error || !data) {
        setSubmitError(
          error?.code === "23505" ? "You already have a claim on this cafe. Check its status instead." : "Couldn't send your claim. Try again.",
        );
        return;
      }
      try {
        await uploadProof(data.id, proof!);
      } catch (e) {
        // The claim is filed; the status page lets them add the proof again.
        await refreshAccess();
        navigate("/status", { state: { proofFailed: e instanceof Error ? e.message : "The upload didn't go through." } });
        return;
      }
      await refreshAccess();
      navigate("/status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid max-w-2xl gap-8">
      <header className="grid gap-2">
        <h1 className="font-display text-3xl font-bold">Claim your cafe</h1>
        <p className="text-muted-foreground">
          We check every claim by hand so nobody can take over a cafe that isn't theirs. It usually takes a day or two.
        </p>
      </header>

      {submitError && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {submitError}
        </p>
      )}

      <section className="grid gap-3" aria-labelledby={`${ids.q}-h`}>
        <h2 id={`${ids.q}-h`} className="text-lg font-semibold">
          1. Your cafe
        </h2>
        {!notListed && (
          <>
            {picked ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
                <div className="min-w-0">
                  <p className="font-medium">{picked.name}</p>
                  {picked.address && <p className="truncate text-sm text-muted-foreground">{picked.address}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => setPicked(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor={ids.q}>Search Visita's listings</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id={ids.q}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cafe name"
                    className="pl-9"
                    aria-describedby={errors.venue ? `${ids.err}-venue` : undefined}
                    aria-invalid={Boolean(errors.venue)}
                  />
                </div>
                {results.length > 0 && (
                  <ul className="divide-y rounded-xl border bg-card">
                    {results.map((v) => {
                      const claimed = openClaims.has(v.id);
                      return (
                        <li key={v.id}>
                          <button
                            type="button"
                            disabled={claimed}
                            onClick={() => setPicked(v)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent disabled:opacity-60"
                          >
                            <Store className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium">{v.name}</span>
                              {v.address && <span className="block truncate text-sm text-muted-foreground">{v.address}</span>}
                            </span>
                            {claimed && <span className="text-xs text-muted-foreground">You've claimed this</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {query.trim().length >= 2 && results.length === 0 && <p className="text-sm text-muted-foreground">No listing matches that name.</p>}
              </div>
            )}
          </>
        )}
        {notListed && (
          <div className="grid gap-3 rounded-xl border bg-card p-4">
            <div className="grid gap-2">
              <Label htmlFor={ids.name}>Cafe name</Label>
              <Input id={ids.name} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} aria-invalid={Boolean(errors.venue)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={ids.address}>Address (optional)</Label>
              <Input id={ids.address} value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Street, barangay" />
            </div>
          </div>
        )}
        <FieldError id={`${ids.err}-venue`} message={errors.venue} />
        <button
          type="button"
          className="w-fit text-sm underline underline-offset-2"
          onClick={() => {
            setNotListed((n) => !n);
            setPicked(null);
          }}
        >
          {notListed ? "Search the listings instead" : "My cafe isn't listed"}
        </button>
      </section>

      <section className="grid gap-4" aria-labelledby={`${ids.role}-h`}>
        <h2 id={`${ids.role}-h`} className="text-lg font-semibold">
          2. About you
        </h2>
        <div className="grid gap-2">
          <Label htmlFor={ids.role}>Your role</Label>
          <Input id={ids.role} value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} list={`${ids.role}-list`} maxLength={80} aria-invalid={Boolean(errors.roleTitle)} />
          <datalist id={`${ids.role}-list`}>
            {ROLES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <FieldError id={`${ids.err}-role`} message={errors.roleTitle} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={ids.phone}>Contact number</Label>
          <Input
            id={ids.phone}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0917 123 4567"
            aria-invalid={Boolean(errors.contactPhone)}
            aria-describedby={`${ids.phone}-hint`}
          />
          <p id={`${ids.phone}-hint`} className="text-xs text-muted-foreground">
            Only Visita's team sees this. We may call to confirm your claim.
          </p>
          <FieldError id={`${ids.err}-phone`} message={errors.contactPhone} />
        </div>
      </section>

      <section className="grid gap-3" aria-labelledby={`${ids.err}-proof-h`}>
        <h2 id={`${ids.err}-proof-h`} className="text-lg font-semibold">
          3. Proof
        </h2>
        <p className="text-sm text-muted-foreground">
          A photo of your business permit, or a selfie at the storefront with the sign visible. Only Visita's team sees it.
        </p>
        <Button variant="outline" className={cn("w-fit", proof && "border-success/50")} onClick={() => fileRef.current?.click()}>
          {proof ? <Check /> : <ImagePlus />} {proof ? proof.name : "Add a photo"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => setProof(e.target.files?.[0] ?? null)}
        />
        <FieldError id={`${ids.err}-proof`} message={errors.proof} />
      </section>

      <div>
        <Button size="lg" onClick={submit} disabled={busy}>
          {busy ? "Sending…" : "Send claim for review"}
        </Button>
      </div>
    </div>
  );
}

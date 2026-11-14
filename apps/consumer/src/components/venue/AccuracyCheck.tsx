import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@visita/ui/button";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@visita/ui/dialog";
import { cn } from "@visita/ui/utils";
import type { AmenityRow } from "@/lib/venue/amenities";
import { MAX_AMENITY_COMMENT, confirmationText, type AmenityVerdict } from "@/lib/venue/amenity-report";

// One "Help keep this accurate" button in place of a "Still accurate?" box
// under every amenity (BEA-14 idea 3). It opens one window listing every
// detail: visitors mark each "Still right" or "Changed", add an optional
// note, and send. Each mark is the same report the per-amenity boxes sent,
// to the same endpoint, so the owner/admin review side is unchanged.

interface Props {
  rows: AmenityRow[];
  venueId: string;
  /** Where sign-in sends the visitor back to; it must carry ?check=1. */
  returnPath: string;
  tone: "dark" | "light";
  className?: string;
}

interface Draft {
  verdicts: Record<string, AmenityVerdict>;
  notes: Record<string, string>;
}

const EMPTY: Draft = { verdicts: {}, notes: {} };
const draftKey = (venueId: string) => `visita:accuracy:${venueId}`;
const legacyNoteKey = (venueId: string, key: string) => `visita:amenity-note:${venueId}:${key}`;

function readDraft(venueId: string): Draft {
  try {
    const raw = sessionStorage.getItem(draftKey(venueId));
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch { /* Storage may be blocked. */ }
  return EMPTY;
}

const wide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

export function AccuracyCheck({ rows, venueId, returnPath, tone, className }: Props) {
  const [open, setOpen] = useState(false);
  const [asDialog, setAsDialog] = useState(wide);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sent, setSent] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const show = () => {
    setAsDialog(wide());
    setThanks(false);
    setErrors({});
    setOpen(true);
  };

  // Back from sign-in (?check=1), or from the older per-amenity flow
  // (?amenity=wifi): reopen with what the visitor had marked. Only the copy
  // that's actually on screen reopens (the desktop panel stays mounted, but
  // hidden, on phones).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const legacy = params.get("amenity");
    if (params.get("check") !== "1" && !(legacy && params.get("walkthrough") === "1")) return;
    if (!buttonRef.current?.offsetParent) return;
    let restored = readDraft(venueId);
    if (legacy && rows.some((row) => row.key === legacy)) {
      let note = "";
      try { note = sessionStorage.getItem(legacyNoteKey(venueId, legacy)) ?? ""; } catch { /* Storage may be blocked. */ }
      restored = { verdicts: { ...restored.verdicts, [legacy]: "dispute" }, notes: { ...restored.notes, [legacy]: note } };
    }
    setDraft(restored);
    show();
    params.delete("check");
    history.replaceState(history.state, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, rows]);

  // Counts and already-sent marks, fetched the first time the window opens.
  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    fetch(`/api/amenity-reports?venueId=${encodeURIComponent(venueId)}`)
      .then(async (res) => (res.ok ? ((await res.json()) as { confirmations?: { amenity_key: string; confirmations: number }[]; openKeys?: string[] }) : null))
      .then((data) => {
        if (!active || !data) return;
        setCounts(Object.fromEntries((data.confirmations ?? []).map((item) => [item.amenity_key, Number(item.confirmations)])));
        setSent(data.openKeys ?? []);
        setLoaded(true);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [open, loaded, venueId]);

  if (rows.length === 0) return null;

  const mark = (key: string, verdict: AmenityVerdict) =>
    setDraft((d) => {
      const verdicts = { ...d.verdicts };
      if (verdicts[key] === verdict) delete verdicts[key];
      else verdicts[key] = verdict;
      return { ...d, verdicts };
    });

  const pending = rows.filter((row) => draft.verdicts[row.key] && !sent.includes(row.key));

  const send = async () => {
    if (busy || pending.length === 0) return;
    setBusy(true);
    setErrors({});
    const failed: Record<string, string> = {};
    const done: string[] = [];
    try {
      for (const row of pending) {
        const verdict = draft.verdicts[row.key]!;
        const response = await fetch("/api/amenity-reports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ venueId, amenityKey: row.key, verdict, comment: verdict === "dispute" ? (draft.notes[row.key] ?? "") : null }),
        });
        if (response.status === 401) {
          // Keep what's left and come back here after signing in.
          try { sessionStorage.setItem(draftKey(venueId), JSON.stringify(draft)); } catch { /* Storage may be blocked. */ }
          location.assign(`/auth/login?next=${encodeURIComponent(returnPath)}`);
          return;
        }
        if (response.ok || response.status === 409) {
          done.push(row.key);
          if (response.ok && verdict === "confirm") setCounts((all) => ({ ...all, [row.key]: (all[row.key] ?? 0) + 1 }));
          continue;
        }
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        failed[row.key] = data.error ?? "Couldn't send this one. Try again.";
      }
    } catch {
      for (const row of pending) if (!done.includes(row.key) && !failed[row.key]) failed[row.key] = "Couldn't send this one. Try again.";
    } finally {
      setBusy(false);
    }
    setSent((keys) => [...new Set([...keys, ...done])]);
    setErrors(failed);
    if (Object.keys(failed).length === 0) {
      setDraft(EMPTY);
      try { sessionStorage.removeItem(draftKey(venueId)); } catch { /* Storage may be blocked. */ }
      setThanks(true);
    }
  };

  const disputed = rows.filter((row) => draft.verdicts[row.key] === "dispute" && !sent.includes(row.key));

  const body = thanks ? (
    <p role="status" className="py-2 text-sm">Thanks for helping keep this up to date. The cafe team will check your update.</p>
  ) : (
    <div className="grid gap-4">
      <ul className="divide-y border-y">
        {rows.map((row) => {
          const count = confirmationText(counts[row.key] ?? 0);
          const verdict = draft.verdicts[row.key];
          const already = sent.includes(row.key);
          return (
            <li key={row.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.text}</p>
                {count && <p className="text-xs text-muted-foreground">{count}</p>}
                {errors[row.key] && <p role="alert" className="text-xs text-destructive">{errors[row.key]}</p>}
              </div>
              {already ? (
                <p className="text-xs text-muted-foreground">Thanks for checking this.</p>
              ) : (
                <div className="flex gap-2" role="group" aria-label={row.label}>
                  {(["confirm", "dispute"] as const).map((v) => (
                    <Button key={v} type="button" size="sm" variant={verdict === v ? "default" : "outline"} aria-pressed={verdict === v} disabled={busy} onClick={() => mark(row.key, v)}>
                      {v === "confirm" ? "Still right" : "Changed"}
                    </Button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {disputed.map((row) => (
        <div key={row.key} className="grid gap-1.5">
          <label htmlFor={`accuracy-note-${row.key}`} className="text-sm">
            What changed with <b>{row.label}</b>? <span className="text-muted-foreground">Optional</span>
          </label>
          <textarea
            id={`accuracy-note-${row.key}`}
            rows={2}
            maxLength={MAX_AMENITY_COMMENT}
            value={draft.notes[row.key] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, notes: { ...d.notes, [row.key]: e.target.value } }))}
            className="w-full rounded-2xl border border-input bg-white px-4 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
          />
        </div>
      ))}
    </div>
  );

  const footer = thanks ? (
    <Button className="w-full sm:w-auto" onClick={() => setOpen(false)}>Done</Button>
  ) : (
    <>
      <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
      <Button className="flex-1" disabled={busy || pending.length === 0} onClick={() => void send()}>
        {busy ? "Sending…" : "Send update"}
      </Button>
    </>
  );

  const intro = "Been here recently? Tell us what's still right and what has changed. You'll need to sign in to send.";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={show}
        className={cn(
          "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
          tone === "dark" ? "border-white/35 hover:bg-white/10" : "border-border text-primary hover:bg-accent",
          className,
        )}
      >
        <Pencil className="size-3.5" aria-hidden="true" /> Help keep this accurate
      </button>
      {asDialog ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Help keep this accurate</DialogTitle>
              <DialogDescription>{intro}</DialogDescription>
            </DialogHeader>
            {body}
            <DialogFooter className="gap-3 sm:flex-row">{footer}</DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <BottomSheet open={open} onOpenChange={setOpen} title="Help keep this accurate" description={intro} footer={<div className="flex gap-3">{footer}</div>}>
          {body}
        </BottomSheet>
      )}
    </>
  );
}

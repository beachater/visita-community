import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { Label } from "@visita/ui/label";
import { uploadScanFile } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { AdminVenue } from "./VenueForm";

// PRD 4.5 scan uploads: the full .sog and (optionally) its preview, made with
// the CLI step in infra/r2/README.md. Each upload is a new version
// (splats/<slug>/v<n>.sog), so visitors mid-walkthrough keep the old files
// until the venue points at the new ones.

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function ScanUpload({ venue, onDone }: { venue: AdminVenue; onDone: () => void }) {
  const [full, setFull] = useState<File | null>(null);
  const [preview, setPreview] = useState<File | null>(null);
  const [scannedOn, setScannedOn] = useState(() => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10));
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    if (!full) return setError("Choose the full .sog file.");
    if (!full.name.endsWith(".sog") || (preview && !preview.name.endsWith(".sog"))) return setError("Scans must be .sog files.");
    setError(null);
    try {
      const total = full.size + (preview?.size ?? 0);
      const f = await uploadScanFile(venue.id, full, "full", undefined, (sent) => setProgress(`Uploading ${mb(sent)} of ${mb(total)}`));
      let previewKey: string | null = null;
      if (preview) {
        const p = await uploadScanFile(venue.id, preview, "preview", f.version, (sent) => setProgress(`Uploading ${mb(full.size + sent)} of ${mb(total)}`));
        previewKey = p.key;
      }
      setProgress("Pointing the listing at the new scan…");
      const { error: e } = await supabase
        .from("venues")
        .update({ splat_url: f.key, splat_preview_url: previewKey, scanned_at: `${scannedOn}T12:00:00+08:00` })
        .eq("id", venue.id);
      if (e) throw new Error(`The files uploaded, but the listing didn't update: ${e.message}`);
      toast.success(`Scan v${f.version} is live${venue.is_published ? "" : " (the venue isn't published yet)"}`);
      setFull(null);
      setPreview(null);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <section aria-labelledby="scan-h" className="grid gap-4 rounded-card border bg-card shadow-card p-5">
      <div>
        <h2 id="scan-h" className="text-lg font-semibold">
          3D scan
        </h2>
        <p className="text-sm text-muted-foreground">
          {venue.splat_url ? (
            <>
              Current: <code>{venue.splat_url}</code>
              {venue.splat_preview_url ? (
                <>
                  {" "}
                  with preview <code>{venue.splat_preview_url}</code>
                </>
              ) : (
                " (no preview)"
              )}
              {venue.scanned_at && `, scanned ${new Date(venue.scanned_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}`}.
            </>
          ) : (
            "Not scanned yet."
          )}{" "}
          Uploading adds a new version; earlier files stay in storage.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="scan-full">Full scan (.sog)</Label>
          <Input id="scan-full" type="file" accept=".sog" onChange={(e) => setFull(e.target.files?.[0] ?? null)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="scan-preview">Preview (.sog, optional)</Label>
          <Input id="scan-preview" type="file" accept=".sog" onChange={(e) => setPreview(e.target.files?.[0] ?? null)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="scan-date">Scanned on</Label>
          <Input id="scan-date" type="date" value={scannedOn} onChange={(e) => setScannedOn(e.target.value)} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {progress && (
        <p role="status" className="text-sm">
          {progress}
        </p>
      )}
      <div>
        <Button onClick={() => void upload()} disabled={progress !== null || !full}>
          {progress ? "Uploading…" : "Upload scan"}
        </Button>
      </div>
    </section>
  );
}

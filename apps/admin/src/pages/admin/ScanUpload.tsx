import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { Label } from "@visita/ui/label";
import { uploadScanFile } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { ScanSetup, type ScanDraft } from "./ScanSetup";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function ScanUpload({ venue, onDone }: { venue: { id: string; splat_url: string | null; scanned_at: string | null }; onDone: () => void }) {
  const [full, setFull] = useState<File | null>(null);
  const [preview, setPreview] = useState<File | null>(null);
  const [scannedOn, setScannedOn] = useState(() => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10));
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ScanDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadDrafts = async () => {
    const { data, error: issue } = await supabase.from("venue_scans")
      .select("id,version,splat_key,preview_key,experience,status")
      .eq("venue_id", venue.id).eq("status", "draft").order("version", { ascending: false });
    if (issue) { setError(issue.message); return; }
    setDrafts(data ?? []);
    setSelectedId((id) => id && data?.some((row) => row.id === id) ? id : data?.[0]?.id ?? null);
  };
  useEffect(() => { void loadDrafts(); }, [venue.id]);

  const upload = async () => {
    if (!full) return setError("Choose the full .sog file.");
    if (!full.name.toLowerCase().endsWith(".sog") || (preview && !preview.name.toLowerCase().endsWith(".sog"))) return setError("Scans must be .sog files.");
    setError(null);
    try {
      const total = full.size + (preview?.size ?? 0);
      const f = await uploadScanFile(venue.id, full, "full", undefined, (sent) => setProgress(`Uploading ${mb(sent)} of ${mb(total)}`));
      let previewKey: string | null = null;
      if (preview) {
        const p = await uploadScanFile(venue.id, preview, "preview", f.version, (sent) => setProgress(`Uploading ${mb(full.size + sent)} of ${mb(total)}`));
        previewKey = p.key;
      }
      setProgress("Creating the setup draft…");
      const { data: draft, error: issue } = await supabase.from("venue_scans")
        .insert({ venue_id: venue.id, version: f.version, splat_key: f.key, preview_key: previewKey, scanned_at: `${scannedOn}T12:00:00+08:00` })
        .select("id").single();
      if (issue) throw new Error(`Files uploaded, but setup draft creation failed: ${issue.message}`);
      toast.success(`Scan v${f.version} uploaded as a draft`);
      setFull(null); setPreview(null);
      await loadDrafts();
      setSelectedId(draft.id);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The upload failed.");
    } finally { setProgress(null); }
  };

  return <div className="grid min-w-0 gap-5">
    <details open={drafts.length === 0} className="rounded-card border bg-card shadow-card">
      <summary className="cursor-pointer p-4 text-sm font-semibold">{drafts.length ? "Upload another scan" : "Upload a scan to get started"}</summary>
    <section aria-labelledby="scan-h" className="grid gap-4 border-t p-5">
      <div>
        <h2 id="scan-h" className="text-lg font-semibold">3D scan</h2>
        <p className="text-sm text-muted-foreground">
          {venue.splat_url ? <>Live: <code>{venue.splat_url}</code>{venue.scanned_at && `, scanned ${new Date(venue.scanned_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}`}.</> : "No live scan yet."}
          {" "}New uploads stay as drafts until you set up and publish the walkthrough.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5"><Label htmlFor="scan-full">Full scan (.sog)</Label><Input id="scan-full" type="file" accept=".sog" onChange={(e) => setFull(e.target.files?.[0] ?? null)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="scan-preview">Preview (.sog, optional)</Label><Input id="scan-preview" type="file" accept=".sog" onChange={(e) => setPreview(e.target.files?.[0] ?? null)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="scan-date">Scanned on</Label><Input id="scan-date" type="date" value={scannedOn} onChange={(e) => setScannedOn(e.target.value)} /></div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {progress && <p role="status" className="text-sm">{progress}</p>}
      <Button className="w-fit" onClick={() => void upload()} disabled={progress !== null || !full}>{progress ? "Uploading…" : "Upload draft scan"}</Button>
    </section></details>
    {drafts.length > 0 && <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">{drafts.map((draft) => <Button key={draft.id} variant={selectedId === draft.id ? "default" : "outline"} onClick={() => setSelectedId(draft.id)}>Draft v{draft.version}</Button>)}</div>
      {drafts.filter((draft) => draft.id === selectedId).map((draft) => <ScanSetup key={draft.id} scan={draft} onPublished={() => { void loadDrafts(); onDone(); }} />)}
    </div>}
  </div>;
}

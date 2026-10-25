import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CircleHelp, RotateCcw, Trash2 } from "lucide-react";
import type { Json, Point2, ScanExperience, ScanPose, ScanStop } from "@visita/shared-types";
import { emptyScanExperience, insideWalkable, parseScanExperience, scanExperienceError } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@visita/ui/dialog";
import { Input } from "@visita/ui/input";
import { Label } from "@visita/ui/label";
import { CONSUMER_URL, supabase } from "@/lib/supabase";
import { ScanPreview, type ScanPreviewHandle } from "./ScanPreview";

export interface ScanDraft {
  id: string;
  version: number;
  splat_key: string;
  preview_key: string | null;
  experience: Json;
  status: string;
}

function readDraft(raw: Json): ScanExperience {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const empty = emptyScanExperience();
  return {
    rotation: Array.isArray(value.rotation) && value.rotation.length === 3 ? value.rotation as ScanExperience["rotation"] : empty.rotation,
    start: value.start && typeof value.start === "object" ? value.start as ScanPose : null,
    walkable: Array.isArray(value.walkable) ? value.walkable as Point2[] : [],
    stops: Array.isArray(value.stops) ? value.stops as ScanStop[] : [],
  };
}

function BoundaryPlan({ points, position }: { points: Point2[]; position: Point2 | null }) {
  const all = position ? [...points, position] : points;
  if (!all.length) return null;
  const xs = all.map((p) => p[0]);
  const zs = all.map((p) => p[1]);
  const minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1;
  const minZ = Math.min(...zs) - 1, maxZ = Math.max(...zs) + 1;
  return <svg viewBox={`${minX} ${minZ} ${Math.max(2, maxX - minX)} ${Math.max(2, maxZ - minZ)}`} className="h-48 w-full rounded-lg border bg-slate-950" aria-label="Top-down walkable area and camera position">
    {points.length >= 3 && <polygon points={points.map((p) => p.join(",")).join(" ")} fill="rgba(39,174,126,.22)" stroke="#4ade80" strokeWidth=".04" />}
    {points.length === 2 && <polyline points={points.map((p) => p.join(",")).join(" ")} fill="none" stroke="#4ade80" strokeWidth=".04" />}
    {points.map(([x, z], i) => <circle key={i} cx={x} cy={z} r=".09" fill="#4ade80" />)}
    {position && <circle cx={position[0]} cy={position[1]} r=".12" fill="#fbbf24" />}
  </svg>;
}

export function ScanSetup({ scan, onPublished, onCancel }: { scan: ScanDraft; onPublished: () => void; onCancel?: () => void }) {
  const editingPublished = scan.status === "published";
  const hasSavedSetup = parseScanExperience(scan.experience) !== null;
  const viewer = useRef<ScanPreviewHandle>(null);
  const [experience, setExperience] = useState(() => readDraft(scan.experience));
  const [current, setCurrent] = useState<ScanPose | null>(null);
  const [label, setLabel] = useState("");
  const [jumpPosition, setJumpPosition] = useState<[string, string, string]>(["0", "0.8", "2.4"]);
  const [testBoundary, setTestBoundary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  useEffect(() => { setExperience(readDraft(scan.experience)); setDirty(false); setTestBoundary(false); setPreviewReady(false); setError(null); setStep(0); }, [scan.id, scan.experience]);

  const update = (next: ScanExperience) => { setExperience(next); setDirty(true); setError(null); };
  const pose = () => viewer.current?.pose() ?? null;
  const save = async (value = experience) => {
    const { error: issue } = await supabase.from("venue_scans").update({ experience: value as unknown as Json }).eq("id", scan.id).eq("status", "draft");
    if (issue) throw issue;
    setDirty(false);
  };
  const saveDraft = async () => {
    setBusy(true);
    try { await save(); toast.success("Walkthrough draft saved"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't save the draft."); }
    finally { setBusy(false); }
  };
  const savePublished = async () => {
    if (!previewReady) { setError("Wait for the scan preview to load before saving."); return; }
    const issue = scanExperienceError(experience);
    if (issue) { setError(issue); return; }
    setBusy(true);
    try {
      const { error: saveError } = await supabase.rpc("update_published_scan_experience", {
        p_scan_id: scan.id,
        p_experience: experience as unknown as Json,
      });
      if (saveError) throw saveError;
      setDirty(false);
      toast.success("Published walkthrough updated");
      onPublished();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't update the walkthrough."); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    if (!previewReady) { setError("Wait for the scan preview to load before publishing."); return; }
    const issue = scanExperienceError(experience);
    if (issue) { setError(issue); return; }
    setBusy(true);
    try {
      await save();
      const { error: publishError } = await supabase.rpc("publish_venue_scan", { p_scan_id: scan.id });
      if (publishError) throw publishError;
      toast.success(`Scan v${scan.version} is live`);
      onPublished();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't publish the scan."); }
    finally { setBusy(false); }
  };
  const captureStart = () => { const at = pose(); if (at) update({ ...experience, start: at }); viewer.current?.focus(); };
  const captureCorner = () => {
    const at = pose(); if (!at) return;
    const corner: Point2 = [at.position[0], at.position[2]];
    if (experience.walkable.some((p) => Math.hypot(p[0] - corner[0], p[1] - corner[1]) < 0.15)) return setError("Move farther from the previous corner.");
    update({ ...experience, walkable: [...experience.walkable, corner] });
    viewer.current?.focus();
  };
  const addStop = () => {
    const at = pose(); if (!at) return;
    if (!experience.start) return setError("Set the entrance view before adding stops.");
    if (!label.trim()) return setError("Name this stop first.");
    at.position[1] = experience.start.position[1];
    viewer.current?.goTo(at);
    update({ ...experience, stops: [...experience.stops, { id: crypto.randomUUID(), label: label.trim(), pose: at }] });
    setLabel("");
    viewer.current?.focus();
  };
  const moveStop = (index: number, by: number) => {
    const stops = [...experience.stops];
    const [item] = stops.splice(index, 1);
    if (!item) return;
    stops.splice(index + by, 0, item);
    update({ ...experience, stops });
  };
  const src = `${CONSUMER_URL}/assets/${scan.splat_key}`;
  const pos = current ? [current.position[0], current.position[2]] as Point2 : null;

  return <section className="grid min-w-0 gap-4" aria-labelledby="setup-h">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 id="setup-h" className="text-xl font-semibold">{editingPublished ? hasSavedSetup ? "Edit published" : "Set up existing" : "Set up"} scan v{scan.version}</h3><p className="text-sm text-muted-foreground">{editingPublished ? "Adjust the walkthrough for this scan. Visitors keep seeing the current setup until you save." : "Prepare the entrance, safe walking area, and optional guided stops before this scan goes live."}</p></div>
      <Dialog><DialogTrigger asChild><Button variant="outline"><CircleHelp /> How to set up a scan</Button></DialogTrigger>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Walkthrough setup guide</DialogTitle><DialogDescription>Use the large preview as if you were walking through the cafe. Your changes stay in a draft until you publish.</DialogDescription></DialogHeader>
          <ol className="grid gap-3 text-sm leading-relaxed">
            <li><strong>1. Face the scan correctly.</strong> Adjust orientation only if the room appears tilted or upside down. Most current exports use X = 180°. Do this first because changing orientation clears saved positions.</li>
            <li><strong>2. Choose the entrance.</strong> Click inside the preview, drag to look, and use W/A/S/D to walk. W moves in the direction you face, A moves left. Q/E changes camera height; Shift walks faster. Press “Set start here” when the view feels right.</li>
            <li><strong>3. Draw the safe area.</strong> Walk to each corner of a safe path and add them in order around its edge. Keep corners inside walls and away from empty space. Turn on the walking limit and try crossing every edge. This outline covers one flat floor and does not stop visitors at tables or walls inside it.</li>
            <li><strong>4. Add stops if useful.</strong> Face a feature such as the counter, name it, then add the stop. The visitor will see these in the order shown. You can reorder or remove them.</li>
            <li><strong>5. Save and test.</strong> {editingPublished ? "Saving updates the visitor walkthrough immediately. The scan file stays the same." : "Save as often as you like. Publishing switches the cafe to this scan and setup together."}</li>
          </ol>
        </DialogContent></Dialog>
    </header>
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)] xl:items-start">
    <div className="grid min-w-0 gap-3 xl:sticky xl:top-4 xl:h-[calc(100dvh-16rem)] xl:min-h-[28rem] xl:grid-rows-[minmax(0,1fr)_auto]">
      <ScanPreview key={scan.id} ref={viewer} src={src} rotation={experience.rotation} walkable={experience.walkable} testBoundary={testBoundary} onPose={setCurrent} onReady={() => setPreviewReady(true)} />
      <div className="grid gap-2 rounded-card border bg-card p-3 shadow-card">
        <p className="text-xs text-muted-foreground">Click the viewer to move · Drag to look · W/A/S/D walk · Q/E height · Shift faster</p>
        {current && <p className="text-xs text-muted-foreground">Current position: {current.position.map((n) => n.toFixed(2)).join(", ")} · Facing: {current.rotation.map((n) => n.toFixed(0)).join(", ")}</p>}
        <details className="text-sm"><summary className="cursor-pointer font-medium">Advanced: jump to coordinates</summary><div className="mt-3 flex flex-wrap items-end gap-2">
      {(["X", "Y (height)", "Z"] as const).map((axis, index) => <div key={axis} className="grid w-24 gap-1"><Label htmlFor={`jump-${index}`}>{axis}</Label><Input id={`jump-${index}`} type="number" step="0.1" value={jumpPosition[index]} onChange={(e) => setJumpPosition((all) => { const next = [...all] as typeof all; next[index] = e.target.value; return next; })} /></div>)}
      <Button variant="outline" onClick={() => { const position = jumpPosition.map(Number); if (position.every(Number.isFinite)) viewer.current?.goTo({ position: position as ScanPose["position"], rotation: pose()?.rotation ?? [0, 0, 0] }); else setError("Enter valid camera coordinates."); }}>Go to coordinates</Button>
      <Button variant="ghost" disabled={!current} onClick={() => current && setJumpPosition(current.position.map((n) => n.toFixed(2)) as typeof jumpPosition)}>Copy current</Button>
        </div></details>
      </div>
    </div>
    <div className="flex min-w-0 flex-col rounded-card border bg-card shadow-card xl:h-[calc(100dvh-16rem)] xl:min-h-[28rem]">
      <nav aria-label="Scan setup steps" className="grid grid-cols-2 gap-2 border-b p-3">
        {["1 · Orientation", "2 · Entrance", "3 · Safe area", "4 · Tour stops"].map((name, index) => <Button key={name} size="sm" variant={step === index ? "default" : "outline"} onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined}>{name}</Button>)}
      </nav>
      <div className="grid min-h-0 content-start gap-4 overflow-y-auto p-4 xl:flex-1">

    {step === 0 && <div className="grid gap-4">
      <h4 className="text-lg font-semibold">Make the room upright</h4>
      <p className="text-sm leading-relaxed text-muted-foreground">Look around the preview. If the floor and walls are already in the right place, leave these values alone. If the room is tilted or upside down, adjust one angle at a time. Most of our current scan exports need X set to 180°.</p>
      <p className="text-sm leading-relaxed text-muted-foreground">Set this before marking the entrance or walking area. Changing any angle clears those saved positions because they may no longer match the room.</p>
      <div className="grid grid-cols-3 gap-2">{(["X", "Y", "Z"] as const).map((axis, index) => <div key={axis} className="grid gap-1"><Label htmlFor={`rot-${axis}`}>{axis} rotation (°)</Label><Input id={`rot-${axis}`} type="number" value={experience.rotation[index]} onChange={(e) => { const rotation = [...experience.rotation] as ScanExperience["rotation"]; rotation[index] = Number(e.target.value); update({ ...emptyScanExperience(), rotation }); }} /></div>)}</div>
      <Button className="w-fit" onClick={() => setStep(1)}>Next: entrance view</Button>
    </div>}

    {step === 1 && <div className="grid gap-4">
      <h4 className="text-lg font-semibold">Choose what visitors see first</h4>
      <p className="text-sm leading-relaxed text-muted-foreground">Click inside the preview, then walk to a welcoming spot near the entrance. Drag until you are facing into the cafe. The position and direction you save here become the first view for every visitor.</p>
      <div className="flex flex-wrap gap-2"><Button onClick={captureStart} disabled={!previewReady}>Set start here</Button>{experience.start && <Button variant="outline" onClick={() => viewer.current?.goTo(experience.start!)}><RotateCcw /> Preview saved start</Button>}</div>
      {experience.start ? <p className="text-sm text-success">Entrance view saved. You can reposition and set it again.</p> : <p className="text-sm text-muted-foreground">No entrance view saved yet.</p>}
      <Button className="w-fit" variant="outline" onClick={() => setStep(2)}>Next: safe walking area</Button>
    </div>}

    {step === 2 && <div className="grid gap-4">
      <h4 className="text-lg font-semibold">Keep visitors inside the cafe</h4>
      <p className="text-sm leading-relaxed text-muted-foreground">Walk around the edge of the space visitors can safely explore. At each turn, select “Add corner here.” Add corners in order around the perimeter; the last one connects back to the first. Keep the outline a little inside walls and away from empty space.</p>
      <p className="text-sm leading-relaxed text-muted-foreground">This is one flat walking area. It cannot block tables, interior walls, stairs, or other floors. Draw around those areas conservatively.</p>
      <div className="flex flex-wrap gap-2"><Button onClick={captureCorner} disabled={!previewReady}>Add corner here</Button><Button variant="outline" disabled={!experience.walkable.length} onClick={() => update({ ...experience, walkable: experience.walkable.slice(0, -1) })}>Undo last</Button><Button variant="ghost" disabled={!experience.walkable.length} onClick={() => update({ ...experience, walkable: [] })}>Clear area</Button></div>
      <BoundaryPlan points={experience.walkable} position={pos} />
      <p className="text-sm">{experience.walkable.length} corners{pos && experience.walkable.length >= 3 ? ` · Your camera is ${insideWalkable(pos, experience.walkable) ? "inside" : "outside"} the area` : ""}</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={testBoundary} disabled={experience.walkable.length < 3} onChange={(e) => setTestBoundary(e.target.checked)} /> Test the walking limit in the preview</label>
      <p className="text-xs text-muted-foreground">When enabled, try walking through every edge. If a boundary is too wide, undo or clear it and place the corners farther inside the cafe.</p>
      <Button className="w-fit" variant="outline" onClick={() => setStep(3)}>Next: tour stops</Button>
    </div>}

    {step === 3 && <div className="grid gap-4">
      <h4 className="text-lg font-semibold">Make a guided tour</h4>
      <p className="text-sm leading-relaxed text-muted-foreground">Stops are optional. Walk to a useful spot, face what visitors should notice, and give it a simple name such as “Counter” or “Window seating.” Visitors can use Previous and Next to jump between stops and can still explore freely.</p>
      <div className="grid gap-2"><Label htmlFor="stop-name">Name this view</Label><div className="flex flex-wrap gap-2"><Input id="stop-name" className="min-w-40 flex-1" placeholder="Counter, seating, entrance…" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} /><Button onClick={addStop} disabled={!previewReady}>Add stop here</Button></div></div>
      {experience.stops.length === 0 && <p className="text-sm text-muted-foreground">No tour stops yet. They are optional.</p>}
      <ol className="grid gap-2">{experience.stops.map((stop, index) => <li key={stop.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2"><span className="min-w-0 flex-1 text-sm">{index + 1}. {stop.label}</span><Button variant="ghost" size="icon-sm" aria-label={`Go to ${stop.label}`} onClick={() => viewer.current?.goTo(stop.pose)}><RotateCcw /></Button><Button variant="ghost" size="icon-sm" aria-label={`Move ${stop.label} up`} disabled={index === 0} onClick={() => moveStop(index, -1)}><ArrowUp /></Button><Button variant="ghost" size="icon-sm" aria-label={`Move ${stop.label} down`} disabled={index === experience.stops.length - 1} onClick={() => moveStop(index, 1)}><ArrowDown /></Button><Button variant="ghost" size="icon-sm" aria-label={`Remove ${stop.label}`} onClick={() => update({ ...experience, stops: experience.stops.filter((item) => item.id !== stop.id) })}><Trash2 /></Button></li>)}</ol>
    </div>}
      </div>
      <footer className="grid gap-2 border-t bg-card p-3">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">{editingPublished ? <><Button disabled={busy || !dirty || !previewReady} onClick={() => void savePublished()}>{busy ? "Saving…" : "Save live changes"}</Button>{onCancel && <Button variant="outline" disabled={busy} onClick={onCancel}>Cancel editing</Button>}</> : <><Button variant="outline" disabled={busy || !dirty} onClick={() => void saveDraft()}>{busy ? "Working…" : "Save draft"}</Button><Button disabled={busy || !previewReady} onClick={() => void publish()}>Publish scan</Button></>}<span className="text-xs text-muted-foreground">{dirty ? "Unsaved changes" : editingPublished ? hasSavedSetup ? "Live setup loaded" : "Existing scan loaded" : "Draft saved"}</span></div>
      </footer>
    </div>
    </div>
  </section>;
}

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, RotateCcw, Trash2 } from "lucide-react";
import type { Json, Point2, ScanExperience, ScanPose, ScanStop } from "@visita/shared-types";
import { emptyScanExperience, insideWalkable, scanExperienceError } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
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

export function ScanSetup({ scan, onPublished }: { scan: ScanDraft; onPublished: () => void }) {
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
  useEffect(() => { setExperience(readDraft(scan.experience)); setDirty(false); setTestBoundary(false); setPreviewReady(false); setError(null); }, [scan.id, scan.experience]);

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
  const captureStart = () => { const at = pose(); if (at) update({ ...experience, start: at }); };
  const captureCorner = () => {
    const at = pose(); if (!at) return;
    const corner: Point2 = [at.position[0], at.position[2]];
    if (experience.walkable.some((p) => Math.hypot(p[0] - corner[0], p[1] - corner[1]) < 0.15)) return setError("Move farther from the previous corner.");
    update({ ...experience, walkable: [...experience.walkable, corner] });
  };
  const addStop = () => {
    const at = pose(); if (!at) return;
    if (!experience.start) return setError("Set the entrance view before adding stops.");
    if (!label.trim()) return setError("Name this stop first.");
    at.position[1] = experience.start.position[1];
    viewer.current?.goTo(at);
    update({ ...experience, stops: [...experience.stops, { id: crypto.randomUUID(), label: label.trim(), pose: at }] });
    setLabel("");
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

  return <section className="grid gap-5 rounded-card border bg-card p-5 shadow-card" aria-labelledby="setup-h">
    <div><h3 id="setup-h" className="text-lg font-semibold">Set up scan v{scan.version}</h3><p className="text-sm text-muted-foreground">Click the preview, drag to look, use W/A/S/D to move and Q/E to change height. Shift moves faster. Changes stay in this draft until you publish.</p></div>
    <ScanPreview key={scan.id} ref={viewer} src={src} rotation={experience.rotation} walkable={experience.walkable} testBoundary={testBoundary} onPose={setCurrent} onReady={() => setPreviewReady(true)} />
    {current && <p className="text-xs text-muted-foreground">Camera: {current.position.map((n) => n.toFixed(2)).join(", ")} · View: {current.rotation.map((n) => n.toFixed(0)).join(", ")}</p>}
    <div className="flex flex-wrap items-end gap-2">
      {(["X", "Y (height)", "Z"] as const).map((axis, index) => <div key={axis} className="grid w-24 gap-1"><Label htmlFor={`jump-${index}`}>{axis}</Label><Input id={`jump-${index}`} type="number" step="0.1" value={jumpPosition[index]} onChange={(e) => setJumpPosition((all) => { const next = [...all] as typeof all; next[index] = e.target.value; return next; })} /></div>)}
      <Button variant="outline" onClick={() => { const position = jumpPosition.map(Number); if (position.every(Number.isFinite)) viewer.current?.goTo({ position: position as ScanPose["position"], rotation: pose()?.rotation ?? [0, 0, 0] }); else setError("Enter valid camera coordinates."); }}>Go to coordinates</Button>
      <Button variant="ghost" disabled={!current} onClick={() => current && setJumpPosition(current.position.map((n) => n.toFixed(2)) as typeof jumpPosition)}>Copy current</Button>
    </div>

    <div className="grid gap-3 border-t pt-4">
      <h4 className="font-medium">1. Orient the scan</h4>
      <p className="text-sm text-muted-foreground">The usual export uses X = 180°. Set orientation before marking positions; changing it clears saved views and corners.</p>
      <div className="grid grid-cols-3 gap-2">{(["X", "Y", "Z"] as const).map((axis, index) => <div key={axis} className="grid gap-1"><Label htmlFor={`rot-${axis}`}>{axis} rotation (°)</Label><Input id={`rot-${axis}`} type="number" value={experience.rotation[index]} onChange={(e) => { const rotation = [...experience.rotation] as ScanExperience["rotation"]; rotation[index] = Number(e.target.value); update({ ...emptyScanExperience(), rotation }); }} /></div>)}</div>
    </div>

    <div className="grid gap-2 border-t pt-4"><h4 className="font-medium">2. Set the entrance view</h4><p className="text-sm text-muted-foreground">Navigate to the place and direction visitors should see first.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={captureStart}>Set start here</Button>{experience.start && <Button variant="ghost" onClick={() => viewer.current?.goTo(experience.start!)}><RotateCcw /> Go to start</Button>}</div>{experience.start && <p className="text-xs text-muted-foreground">Start saved at {experience.start.position.map((n) => n.toFixed(2)).join(", ")}</p>}</div>

    <div className="grid gap-3 border-t pt-4"><h4 className="font-medium">3. Mark the walkable area</h4><p className="text-sm text-muted-foreground">Move around the safe walking perimeter and add corners in order. Keep the outline inside walls and away from the void. Use one outline for a single level.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={captureCorner}>Add corner here</Button><Button variant="ghost" disabled={!experience.walkable.length} onClick={() => update({ ...experience, walkable: experience.walkable.slice(0, -1) })}>Undo corner</Button><Button variant="ghost" disabled={!experience.walkable.length} onClick={() => update({ ...experience, walkable: [] })}>Clear area</Button></div><BoundaryPlan points={experience.walkable} position={pos} /><p className="text-xs text-muted-foreground">{experience.walkable.length} corners{pos && experience.walkable.length >= 3 ? ` · camera ${insideWalkable(pos, experience.walkable) ? "inside" : "outside"} area` : ""}</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={testBoundary} disabled={experience.walkable.length < 3} onChange={(e) => setTestBoundary(e.target.checked)} /> Test walking limit in preview</label></div>

    <div className="grid gap-3 border-t pt-4"><h4 className="font-medium">4. Add optional tour stops</h4><div className="flex flex-wrap gap-2"><Input className="max-w-xs" aria-label="Stop name" placeholder="Counter, seating, entrance…" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} /><Button variant="outline" onClick={addStop}>Add stop here</Button></div><ol className="grid gap-2">{experience.stops.map((stop, index) => <li key={stop.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2"><span className="min-w-0 flex-1 text-sm">{index + 1}. {stop.label}</span><Button variant="ghost" size="icon-sm" aria-label={`Go to ${stop.label}`} onClick={() => viewer.current?.goTo(stop.pose)}><RotateCcw /></Button><Button variant="ghost" size="icon-sm" aria-label={`Move ${stop.label} up`} disabled={index === 0} onClick={() => moveStop(index, -1)}><ArrowUp /></Button><Button variant="ghost" size="icon-sm" aria-label={`Move ${stop.label} down`} disabled={index === experience.stops.length - 1} onClick={() => moveStop(index, 1)}><ArrowDown /></Button><Button variant="ghost" size="icon-sm" aria-label={`Remove ${stop.label}`} onClick={() => update({ ...experience, stops: experience.stops.filter((item) => item.id !== stop.id) })}><Trash2 /></Button></li>)}</ol></div>

    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" disabled={busy || !dirty} onClick={() => void saveDraft()}>{busy ? "Working…" : "Save draft"}</Button><Button disabled={busy || !previewReady} onClick={() => void publish()}>Tested — publish scan</Button></div>
  </section>;
}

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { emptyScanExperience, parseScanExperience } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { CONSUMER_URL } from "@/lib/supabase";
import { ScanPreview, type ScanPreviewHandle } from "./ScanPreview";
import { ScanSetup } from "./ScanSetup";
import type { ScanDraft } from "./ScanSetup";

export function PublishedScan({ scan, onUpdated }: { scan: ScanDraft; onUpdated: () => void }) {
  const viewer = useRef<ScanPreviewHandle>(null);
  const [editing, setEditing] = useState(false);
  const configured = parseScanExperience(scan.experience);
  const experience = configured ?? emptyScanExperience();

  if (editing) return <ScanSetup scan={scan} onPublished={() => { setEditing(false); onUpdated(); }} onCancel={() => setEditing(false)} />;

  return <section className="grid min-w-0 gap-4 rounded-card border bg-card p-4 shadow-card" aria-labelledby="published-scan-h">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="published-scan-h" className="text-lg font-semibold">Published scan v{scan.version}</h2>
      <p className="text-sm text-muted-foreground">{configured ? "This is the scan currently attached to the cafe. Click the viewer to walk through it; the entrance and stops below show what visitors will see." : "This scan is already live. Its entrance, safe walking area, and tour stops have not been set up in admin yet. You can set them up using the existing file."}</p></div>
      <Button onClick={() => setEditing(true)}>{configured ? "Edit walkthrough" : "Set up walkthrough"}</Button></div>
    <div className="xl:h-[min(68vh,46rem)]"><ScanPreview key={scan.id} ref={viewer} src={`${CONSUMER_URL}/assets/${scan.splat_key}`} rotation={experience.rotation} walkable={experience.walkable} testBoundary onPose={() => {}} onReady={() => { if (experience.start) viewer.current?.goTo(experience.start); }} /></div>
    <div className="flex flex-wrap gap-2">
      {experience.start && <Button variant="outline" onClick={() => viewer.current?.goTo(experience.start!)}><RotateCcw /> Go to entrance</Button>}
      {experience.stops.map((stop, index) => <Button key={stop.id} variant="outline" onClick={() => viewer.current?.goTo(stop.pose)}>{index + 1}. {stop.label}</Button>)}
    </div>
    <p className="text-xs text-muted-foreground">Edit the entrance, orientation, walking area, or stops using this scan file. Upload a replacement only when the 3D file itself changes.</p>
  </section>;
}

import { useEffect, useMemo, useState } from "react";
import { getDeviceProfile } from "../../lib/splat/device";
import { splatSrc } from "../../lib/splat/source";
import { SplatViewer } from "./SplatViewer";

// The walkthrough block on /cafe/[slug]. Nothing downloads until the visitor
// asks: a scan is tens of megabytes, which matters on mobile data.

interface Props {
  name: string;
  /** R2 keys from venues.splat_url / splat_preview_url. */
  splatKey: string;
  previewKey: string | null;
}

type Stage = "idle" | "confirm" | "unsupported" | "viewing";

export function CafeWalkthrough({ name, splatKey, previewKey }: Props) {
  const profile = useMemo(getDeviceProfile, []);
  const [stage, setStage] = useState<Stage>("idle");
  const [expanded, setExpanded] = useState(false);

  // Escape leaves the expanded view; the page doesn't scroll behind it.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const start = () => {
    if (!profile.webgl2) return setStage("unsupported");
    if (profile.lowEnd && stage !== "confirm") return setStage("confirm");
    setStage("viewing");
  };

  return (
    <section
      aria-label={`3D walkthrough of ${name}`}
      style={
        expanded
          ? { position: "fixed", inset: 0, zIndex: 50, background: "var(--navy)" }
          : { position: "relative", aspectRatio: "4 / 3", maxHeight: "70vh", width: "100%", borderRadius: "16px", overflow: "hidden", background: "var(--navy)" }
      }
    >
      {stage === "viewing" ? (
        <>
          <SplatViewer src={splatSrc(splatKey)} previewSrc={previewKey ? splatSrc(previewKey) : undefined} profile={profile} />
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            aria-label={expanded ? "Exit full screen" : "Full screen"}
            style={{ ...pill, position: "absolute", top: "max(0.75rem, env(safe-area-inset-top))", right: "0.75rem" }}
          >
            {expanded ? "Close" : "Full screen"}
          </button>
        </>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: "1.5rem", textAlign: "center", color: "var(--cloud)" }}>
          <div style={{ display: "grid", gap: "0.75rem", justifyItems: "center", maxWidth: "24rem" }}>
            {stage === "unsupported" ? (
              <p style={{ margin: 0 }}>This browser can't show 3D walkthroughs. It needs WebGL 2.</p>
            ) : stage === "confirm" ? (
              <>
                <p style={{ margin: 0 }}>This device may struggle with the walkthrough. It could be slow or close unexpectedly.</p>
                <button type="button" onClick={() => setStage("viewing")} style={primary}>
                  Try anyway
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.5rem" }}>Walk through {name}</p>
                <p style={{ margin: 0, color: "var(--mist)", fontSize: "0.9rem" }}>
                  A real, unedited scan of the room. A quick preview loads first, then full detail.
                </p>
                <button type="button" onClick={start} style={primary}>
                  Step inside
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// Interactive colour is ocean on navy; amber is reserved for "scanned".
const primary = {
  font: "inherit",
  fontWeight: 500,
  padding: "0.7rem 1.4rem",
  borderRadius: "999px",
  border: "none",
  background: "var(--ocean)",
  color: "#ffffff",
  cursor: "pointer",
};

const pill = {
  font: "inherit",
  fontSize: "0.8rem",
  padding: "0.35rem 0.8rem",
  borderRadius: "999px",
  border: "1px solid var(--mist)",
  background: "rgba(4, 44, 83, 0.7)",
  color: "var(--cloud)",
  cursor: "pointer",
};

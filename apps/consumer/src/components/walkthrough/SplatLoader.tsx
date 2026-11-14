// The Visita V mark filling with colour as the scan arrives (PRD 4.2). Progress
// is always real: bytes when the download reports them.

export type LoadProgress =
  | { stage: "engine" }
  | { stage: "downloading"; received: number; total: number | null; label?: string }
  | { stage: "preparing"; fraction: number | null }
  | { stage: "done" };

function describe(progress: LoadProgress): { fraction: number | null; label: string } {
  switch (progress.stage) {
    case "engine":
      return { fraction: null, label: "Stepping inside…" };
    case "downloading":
      return { fraction: progress.total ? progress.received / progress.total : null, label: "Stepping inside…" };
    case "preparing":
      return { fraction: progress.fraction ?? 1, label: "Stepping inside…" };
    case "done":
      return { fraction: 1, label: "" };
  }
}

// Approved 2026-11-14: the Visita V mark fills with colour from the bottom as
// the room really arrives, with one short line and the cafe's name. No
// download sizes or percentages on screen (the progress bar still reports
// them to assistive tech).
export function SplatLoader({ progress, cafeName }: { progress: LoadProgress; cafeName?: string }) {
  const { fraction, label } = describe(progress);
  const percent = fraction === null ? null : Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  return (
    <div
      role="progressbar"
      aria-label={cafeName ? `Opening ${cafeName}` : "Opening the room"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        background: "var(--navy)",
        color: "var(--cloud)",
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "relative", width: "8.25rem", height: "8.5rem" }}>
        <img src="/brand/visita-mark.svg" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: "grayscale(1) brightness(1.9)", opacity: 0.16 }} />
        <img
          src="/brand/visita-mark.svg"
          alt=""
          className={percent === null ? "splat-loader-breathe" : undefined}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            // Fill from the bottom up; while the size is unknown, a gentle pulse instead.
            clipPath: percent === null ? undefined : `inset(${100 - percent}% 0 0 0)`,
            transition: "clip-path 200ms linear",
          }}
        />
      </div>
      <p style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 600 }}>{label}</p>
      {cafeName && <p style={{ margin: "-0.75rem 0 0", fontSize: "0.8125rem", color: "var(--mist)" }}>{cafeName}</p>}
    </div>
  );
}

// The Visita "V" filling with amber as the scan arrives (PRD 4.2). Progress is
// always real: bytes when the download reports them, streamed chunks after
// that. With nothing to report it says so rather than animating a guess.

export type LoadProgress =
  | { stage: "engine" }
  | { stage: "downloading"; received: number; total: number | null; label?: string }
  | { stage: "preparing"; fraction: number | null }
  | { stage: "done" };

const MB = 1024 * 1024;
const mb = (bytes: number) => (bytes / MB).toFixed(1);

function describe(progress: LoadProgress): { fraction: number | null; label: string; detail: string | null } {
  switch (progress.stage) {
    case "engine":
      return { fraction: null, label: "Starting the viewer", detail: null };
    case "downloading": {
      const { received, total } = progress;
      const label = progress.label ?? "Downloading the scan";
      if (total) {
        return { fraction: received / total, label, detail: `${mb(received)} of ${mb(total)} MB` };
      }
      return { fraction: null, label, detail: received > 0 ? `${mb(received)} MB` : null };
    }
    case "preparing":
      return { fraction: progress.fraction, label: "Setting up the room", detail: null };
    case "done":
      return { fraction: 1, label: "", detail: null };
  }
}

export function SplatLoader({ progress }: { progress: LoadProgress }) {
  const { fraction, label, detail } = describe(progress);
  const percent = fraction === null ? null : Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      aria-valuetext={detail ?? label}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        background: "var(--navy)",
        color: "var(--cloud)",
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "relative", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "5rem", lineHeight: 1 }}>
        <span style={{ color: "rgba(230, 241, 251, 0.18)" }}>V</span>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            color: "var(--amber)",
            // Fill from the bottom up.
            clipPath: `inset(${100 - (percent ?? 0)}% 0 0 0)`,
            transition: "clip-path 150ms linear",
          }}
        >
          V
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "1rem" }}>{label}</p>
      <p style={{ margin: 0, minHeight: "1.25em", fontSize: "0.875rem", color: "var(--mist)", fontVariantNumeric: "tabular-nums" }}>
        {detail ?? (percent !== null ? `${percent}%` : "")}
      </p>
    </div>
  );
}

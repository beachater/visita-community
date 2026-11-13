import { useEffect, useRef, useState } from "react";
import { formatReport, type DiagnosticsSnapshot } from "../../lib/splat/diagnostics";

// The `?debug=splat` readout for phone tests: the load numbers, refreshed
// twice a second, and a Copy button for the full report (with device details)
// so the tester pastes exact values. It sits below the top controls and the
// preview pill, and Hide shrinks it to one line.

export function SplatDebugPanel({ snapshot }: { snapshot: () => DiagnosticsSnapshot }) {
  const [text, setText] = useState(() => formatReport(snapshot(), { brief: true }));
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const [collapsed, setCollapsed] = useState(false);
  // The parent re-renders on every download progress event; read through a
  // ref so the timer isn't reset each time.
  const read = useRef(snapshot);
  read.current = snapshot;

  useEffect(() => {
    const timer = window.setInterval(() => setText(formatReport(read.current(), { brief: true })), 500);
    return () => window.clearInterval(timer);
  }, []);

  const copy = async () => {
    const report = formatReport(read.current());
    try {
      await navigator.clipboard.writeText(report);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 2000);
  };

  return (
    <div
      aria-label="Walkthrough debug readout"
      style={{
        position: "absolute",
        zIndex: 40,
        top: "max(7.5rem, calc(env(safe-area-inset-top) + 7rem))",
        right: "0.5rem",
        maxWidth: "min(24rem, calc(100vw - 1rem))",
        padding: "0.5rem 0.6rem",
        borderRadius: "0.5rem",
        background: "rgba(0, 0, 0, 0.72)",
        color: "#e6f1fb",
        font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
        <strong style={{ marginRight: "auto" }}>splat debug</strong>
        <button type="button" onClick={copy} style={debugButton}>
          {copied === "done" ? "Copied" : copied === "failed" ? "Select text below" : "Copy"}
        </button>
        <button type="button" onClick={() => setCollapsed((c) => !c)} style={debugButton} aria-expanded={!collapsed}>
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>
      {!collapsed && (
        <pre style={{ margin: "0.4rem 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", userSelect: "text", WebkitUserSelect: "text" }}>
          {text}
        </pre>
      )}
    </div>
  );
}

const debugButton = {
  font: "inherit",
  padding: "0.15rem 0.5rem",
  borderRadius: "0.3rem",
  border: "1px solid rgba(230, 241, 251, 0.5)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

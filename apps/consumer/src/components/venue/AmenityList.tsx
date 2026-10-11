import { useEffect, useState } from "react";
import type { AmenityRow } from "@/lib/venue/amenities";
import { MAX_AMENITY_COMMENT, amenityReturnPath, confirmationText, type AmenityVerdict } from "@/lib/venue/amenity-report";

interface Confirmation {
  amenity_key: string;
  confirmations: number;
}

interface Props {
  rows: AmenityRow[];
  venueId: string;
  slug: string;
  tone?: "page" | "glass";
}

export function AmenityList({ rows, venueId, slug, tone = "page" }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  const glass = tone === "glass";

  useEffect(() => {
    let active = true;
    fetch(`/api/amenity-reports?venueId=${encodeURIComponent(venueId)}`)
      .then(async (res): Promise<{ confirmations?: Confirmation[]; openKeys?: string[] } | null> =>
        res.ok ? (await res.json()) as { confirmations?: Confirmation[]; openKeys?: string[] } : null)
      .then((data: { confirmations?: Confirmation[]; openKeys?: string[] } | null) => {
        if (!active || !data) return;
        setCounts(Object.fromEntries((data.confirmations ?? []).map((item) => [item.amenity_key, Number(item.confirmations)])));
        setOpenKeys(data.openKeys ?? []);
      }).catch(() => {});
    const wanted = new URLSearchParams(location.search).get("amenity");
    if (wanted && rows.some((row) => row.key === wanted)) {
      setEditing(wanted);
      try { setComment(sessionStorage.getItem(`visita:amenity-note:${venueId}:${wanted}`) ?? ""); } catch { /* Storage may be blocked. */ }
      requestAnimationFrame(() => document.getElementById(`amenity-${wanted}`)?.scrollIntoView({ block: "center" }));
    }
    return () => { active = false; };
  }, [venueId, rows]);

  const send = async (key: string, verdict: AmenityVerdict) => {
    if (busy) return;
    setBusy(key);
    setMessage((all) => ({ ...all, [key]: "" }));
    try {
      const response = await fetch("/api/amenity-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ venueId, amenityKey: key, verdict, comment: verdict === "dispute" ? comment : null }),
      });
      if (response.status === 401) {
        if (verdict === "dispute") {
          try { sessionStorage.setItem(`visita:amenity-note:${venueId}:${key}`, comment); } catch { /* Storage may be blocked. */ }
        }
        const next = amenityReturnPath(slug, key, glass);
        location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        if (response.status === 409) setOpenKeys((keys) => [...new Set([...keys, key])]);
        setMessage((all) => ({ ...all, [key]: data.error ?? "Couldn't send your update. Try again." }));
        return;
      }
      setOpenKeys((keys) => [...new Set([...keys, key])]);
      if (verdict === "confirm") setCounts((all) => ({ ...all, [key]: (all[key] ?? 0) + 1 }));
      setEditing(null);
      setComment("");
      try { sessionStorage.removeItem(`visita:amenity-note:${venueId}:${key}`); } catch { /* Storage may be blocked. */ }
      setMessage((all) => ({ ...all, [key]: "Thanks for helping keep this up to date." }));
    } catch {
      setMessage((all) => ({ ...all, [key]: "Couldn't send your update. Try again." }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <dl className={glass ? "grid gap-3" : "grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3"}>
      {rows.map((row) => {
        const done = openKeys.includes(row.key);
        const count = confirmationText(counts[row.key] ?? 0);
        return (
          <div id={`amenity-${row.key}`} key={row.key} className={glass ? "min-w-0 border-b border-white/15 pb-3 text-sm last:border-0" : "min-w-0 rounded-[1.25rem] bg-white p-4 shadow-card"}>
            <dt className={glass ? "text-xs opacity-70" : "text-xs text-[#185FA5]"}>{row.label}</dt>
            <dd className="mt-1 font-medium">{row.text}</dd>
            {count && <p className={glass ? "mt-2 text-xs opacity-80" : "mt-2 text-xs text-[#185FA5]"}>{count}</p>}
            {done ? (
              <p className={glass ? "mt-2 text-xs opacity-80" : "mt-2 text-xs text-[#185FA5]"}>Thanks for checking this amenity.</p>
            ) : (
              <div className="mt-3">
                <p className="text-xs font-medium">Still accurate?</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <button type="button" disabled={busy !== null} onClick={() => void send(row.key, "confirm")}
                    className={glass ? "min-h-11 rounded-full border border-white/35 px-4 text-sm hover:bg-white/15 disabled:opacity-50" : "min-h-11 rounded-full border border-[#B5D4F4] px-4 text-sm text-[#042C53] hover:bg-[#E6F1FB] disabled:opacity-50"}>
                    Confirm
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => { setEditing(editing === row.key ? null : row.key); setComment(""); }}
                    aria-expanded={editing === row.key}
                    className={glass ? "min-h-11 rounded-full border border-white/35 px-4 text-sm hover:bg-white/15 disabled:opacity-50" : "min-h-11 rounded-full border border-[#B5D4F4] px-4 text-sm text-[#042C53] hover:bg-[#E6F1FB] disabled:opacity-50"}>
                    Something's changed
                  </button>
                </div>
                {editing === row.key && (
                  <div className="mt-3 grid gap-2">
                    <label htmlFor={`amenity-note-${row.key}`} className="text-xs">What changed? <span className="opacity-70">Optional</span></label>
                    <textarea id={`amenity-note-${row.key}`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={MAX_AMENITY_COMMENT} rows={3}
                      className={glass ? "w-full rounded-xl border border-white/35 bg-[#042C53] p-3 text-base text-white" : "w-full rounded-xl border border-[#B5D4F4] bg-white p-3 text-base text-[#042C53]"} />
                    <button type="button" disabled={busy !== null} onClick={() => void send(row.key, "dispute")}
                      className={glass ? "min-h-11 rounded-full bg-white px-4 text-sm font-medium text-[#042C53] disabled:opacity-50" : "min-h-11 rounded-full bg-[#185FA5] px-4 text-sm font-medium text-white disabled:opacity-50"}>
                      Send update
                    </button>
                  </div>
                )}
              </div>
            )}
            {message[row.key] && <p role="status" className="mt-2 text-xs">{message[row.key]}</p>}
          </div>
        );
      })}
    </dl>
  );
}

// "Scanned March 2026", muted once it's over twelve months old (PRD 4.2).
// A scan with no known date shows nothing rather than a guess.

export function scanDate(scannedAt: string | null, now = new Date()): { label: string; stale: boolean } | null {
  if (!scannedAt) return null;
  const date = new Date(scannedAt);
  if (Number.isNaN(date.getTime())) return null;

  const months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  const label = `Scanned ${date.toLocaleString("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" })}`;
  return { label, stale: months > 12 };
}

const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });

export const formatPhp = (amount: number) => php.format(amount).replace(/\.00$/, "");

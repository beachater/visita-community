// Embed widget: one venue's walkthrough, nothing else (PRD 5.4).
// Usage: <iframe src="https://embed.visita.ph/?venue=<slug>"></iframe>
//
// TODO: fetch the venue's splat_url from Supabase's public read API (anon key,
// published venues only via RLS), load the .sog from R2, and render it with
// the PlayCanvas engine.

const slug = new URLSearchParams(location.search).get("venue");
const badge = document.getElementById("badge");

if (slug && badge) {
  badge.href = `https://visita.ph/cafe/${encodeURIComponent(slug)}`;
}

console.log("[visita-embed] venue:", slug);

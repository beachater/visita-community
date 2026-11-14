import { useEffect, useState } from "react";
import { getConsent, setConsent, type ConsentChoice } from "@/lib/consent";

// The privacy notice (RA 10173) as a block inside the phone map's cafe sheet
// (approved 2026-11-14), so it never covers the sheet or the map buttons.
// Same words and choices as ConsentBanner; answering either one closes both
// (they share the "visita:consent" event).

export function ConsentInline() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(getConsent() === null);
    const close = () => setOpen(false);
    window.addEventListener("visita:consent", close);
    return () => window.removeEventListener("visita:consent", close);
  }, []);

  if (!open) return null;
  const choose = (choice: ConsentChoice) => setConsent(choice);

  return (
    <section aria-label="Privacy choices" className="mx-3 grid gap-2.5 rounded-[1.25rem] bg-muted p-3.5">
      <p className="text-[0.8rem] leading-snug">
        Visita keeps a little data on this device so the site works: your sign-in, saved cafes and recently viewed. With your OK, we also count visits and
        walkthrough opens so cafes can see how their listing is doing. No advertising trackers.{" "}
        <a href="/privacy" className="font-medium text-primary underline underline-offset-2">Privacy policy</a>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => choose("essential")} className="h-11 rounded-full border border-border bg-card text-sm font-semibold hover:bg-accent">
          Essential only
        </button>
        <button type="button" onClick={() => choose("all")} className="h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Allow usage stats
        </button>
      </div>
    </section>
  );
}

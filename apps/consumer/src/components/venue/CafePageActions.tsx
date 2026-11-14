import { useState } from "react";
import { useStore } from "@nanostores/react";
import { Heart, MessageSquare, Navigation, Share2, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { cn } from "@visita/ui/utils";
import { $saved, toggleSaved } from "@/lib/visitor/stores";

// The cafe page's round quick actions (approved cafe page, 2026-11-14), the
// same set as the map and walkthrough panels: Directions, Reviews, Menu, Save,
// Share. Reviews and Menu jump to their sections on the page.

interface Props {
  slug: string;
  name: string;
  directionsHref: string | null;
  hasMenu: boolean;
}

const round = "grid size-13 place-items-center rounded-full bg-accent text-primary transition-colors group-hover:bg-mist/60";
const item = "group grid min-w-0 justify-items-center gap-1.5 text-xs font-medium";

export function CafePageActions({ slug, name, directionsHref, hasMenu }: Props) {
  const saved = useStore($saved).includes(slug);
  const [shared, setShared] = useState(false);

  const share = async () => {
    const url = `${location.origin}/cafe/${slug}`;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        window.setTimeout(() => setShared(false), 2000);
      }
    } catch {
      /* Share sheet dismissed. */
    }
  };

  const links: { label: string; icon: LucideIcon; href: string; external?: boolean }[] = [];
  if (directionsHref) links.push({ label: "Directions", icon: Navigation, href: directionsHref, external: true });
  links.push({ label: "Reviews", icon: MessageSquare, href: "#reviews" });
  if (hasMenu) links.push({ label: "Menu", icon: UtensilsCrossed, href: "#menu" });

  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${links.length + 2}, minmax(0, 1fr))` }}>
      {links.map(({ label, icon: Icon, href, external }) => (
        <a key={label} href={href} className={item} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
          <span className={round}><Icon className="size-5" aria-hidden="true" /></span>
          {label}
        </a>
      ))}
      <button type="button" className={item} aria-pressed={saved} onClick={() => toggleSaved(slug)}>
        <span className={round}><Heart className={cn("size-5", saved && "fill-current")} aria-hidden="true" /></span>
        {saved ? "Saved" : "Save"}
      </button>
      <button type="button" className={item} onClick={() => void share()}>
        <span className={round}><Share2 className="size-5" aria-hidden="true" /></span>
        <span aria-live="polite">{shared ? "Copied" : "Share"}</span>
      </button>
    </div>
  );
}

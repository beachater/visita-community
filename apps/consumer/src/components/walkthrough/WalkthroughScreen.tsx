import { track } from "@/lib/analytics/track";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { toast } from "sonner";
import { BadgeCheck, ChevronUp, Heart, Share2, X } from "lucide-react";
import type { AmenityDefinition } from "@visita/shared-types";
import { Button } from "@visita/ui/button";
import { Toaster } from "@visita/ui/sonner";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { cn } from "@visita/ui/utils";
import type { DeviceProfile } from "@/lib/splat/device";
import { splatSrc } from "@/lib/splat/source";
import { currentPosition, formatDistance, haversineMeters, locationAlreadyAllowed } from "@/lib/venue/distance";
import { formatPhp } from "@/lib/venue/scan";
import { isOpenAt } from "@/lib/venue/hours";
import type { WalkthroughCafe } from "@/lib/venue/types";
import { $saved, recordRecent, toggleSaved } from "@/lib/visitor/stores";
import { useDirections } from "../directions/useDirections";
import { InfoPanel } from "./InfoPanel";
import { MobileInfoSheet } from "./MobileInfoSheet";
import { WalkthroughReviews } from "../reviews/WalkthroughReviews";
import { SplatViewer } from "./SplatViewer";

// PRD 4.2 in one screen: the 3D walkthrough full-screen, a glass info panel
// on the left, save and share at the top, the menu in a sheet, and
// directions handed off to a maps app. Used by the cafe page now and by the
// map overlay later.

interface Props {
  cafe: WalkthroughCafe;
  definitions: AmenityDefinition[];
  profile: DeviceProfile;
  onClose: () => void;
}

const glassButton =
  "glass-dark size-11 border-0 hover:text-glass-foreground hover:brightness-125";

export function WalkthroughScreen({ cafe, definitions, profile, onClose }: Props) {
  const saved = useStore($saved).includes(cafe.slug);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches && new URLSearchParams(window.location.search).get("walkthrough") === "1",
  );
  const [now, setNow] = useState(() => new Date());
  const [distance, setDistance] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const hasCoords = cafe.lat !== null && cafe.lng !== null;
  const shareUrl = `${location.origin}/cafe/${cafe.slug}`;
  const venueOpen = isOpenAt(cafe.hours, now);

  useEffect(() => {
    recordRecent(cafe.slug);
    closeRef.current?.focus();
  }, [cafe.slug]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const closeSheetOnDesktop = () => { if (media.matches) setInfoOpen(false); };
    media.addEventListener("change", closeSheetOnDesktop);
    return () => media.removeEventListener("change", closeSheetOnDesktop);
  }, []);

  // Show distance without prompting if location was already allowed.
  const measure = async (prompt: boolean) => {
    if (!hasCoords) return;
    if (!prompt && !(await locationAlreadyAllowed())) return;
    try {
      const here = await currentPosition();
      setDistance(formatDistance(haversineMeters(here, { lat: cafe.lat!, lng: cafe.lng! })));
    } catch {
      if (prompt) toast("Couldn't get your location. You can allow it in your browser settings.");
    }
  };
  useEffect(() => {
    void measure(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafe.slug]);

  const onSave = () => {
    const nowSaved = toggleSaved(cafe.slug);
    toast(nowSaved ? `Saved ${cafe.name}` : `Removed ${cafe.name} from saved`);
  };

  const onShare = async () => {
    const data = { title: `${cafe.name} · Visita`, text: `Step inside ${cafe.name} before you go.`, url: shareUrl };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return; // Visitor closed the share sheet.
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast(shareUrl, { description: "Copy this link to share it." });
    }
  };

  const directions = useDirections();
  const onDirections = () => {
    track("directions_tap", cafe.id);
    directions.open(cafe);
  };

  const sections = [...new Set(cafe.menu.map((m) => m.section ?? ""))];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Walkthrough of ${cafe.name}`}
      className="fixed inset-0 z-50 bg-scan"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !infoOpen && !menuOpen && !reviewsOpen && !directions.isOpen) onClose();
      }}
    >
      <Toaster position="top-center" />

      <SplatViewer src={splatSrc(cafe.splatKey)} previewSrc={cafe.previewKey ? splatSrc(cafe.previewKey) : undefined} profile={profile} />

      {/* Controls float above the scan; the gaps between them stay touchable for looking around. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-4 md:p-3" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center justify-between gap-2">
          <Button ref={closeRef} size="icon" className={cn(glassButton, "pointer-events-auto rounded-full")} aria-label="Close walkthrough" onClick={onClose}>
            <X className="size-5" />
          </Button>
          <div className="pointer-events-auto flex gap-2">
            <Button size="icon" className={cn(glassButton, "rounded-full")} aria-label={saved ? "Remove from saved" : "Save cafe"} aria-pressed={saved} onClick={onSave}>
              <Heart className={cn("size-5", saved && "fill-current")} />
            </Button>
            <Button size="icon" className={cn(glassButton, "rounded-full")} aria-label="Share" onClick={onShare}>
              <Share2 className="size-5" />
            </Button>
          </div>
        </div>

        {/* PRD: the panel sits on the left. It caps its height so the lower
            screen stays free for the walking joystick. */}
        <div className="hidden max-h-[calc(100%-9rem)] w-[min(22rem,100%)] min-h-0 md:flex">
          <InfoPanel
            cafe={cafe}
            definitions={definitions}
            distance={distance}
            onRequestDistance={hasCoords ? () => void measure(true) : null}
            onDirections={onDirections}
            onOpenMenu={() => setMenuOpen(true)}
            onOpenReviews={() => setReviewsOpen(true)}
          />
        </div>
      </div>

      <button
        type="button"
        className="glass-dark absolute right-4 left-4 z-10 flex min-h-[66px] items-center gap-3 rounded-[1.2rem] border border-white/25 px-4 py-2 text-left text-glass-foreground shadow-[0_10px_30px_rgba(0,20,36,0.35)] backdrop-blur-xl md:hidden"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
        aria-label={`Show details about ${cafe.name}`}
        aria-expanded={infoOpen}
        onClick={() => setInfoOpen(true)}
      >
        <span className="min-w-0 flex-1">
          <strong className="block truncate font-display text-base leading-tight">{cafe.name}</strong>
          <span className="mt-1 flex items-center gap-1 text-xs text-glass-foreground/80">
            <BadgeCheck className="size-3.5 shrink-0 text-verified" aria-hidden="true" />
            <span className="truncate">Scanned{venueOpen === null ? "" : venueOpen ? " · Open now" : " · Closed"} · Tap for details</span>
          </span>
        </span>
        <ChevronUp className="size-5 shrink-0" aria-hidden="true" />
      </button>

      <MobileInfoSheet
        cafe={cafe}
        definitions={definitions}
        open={infoOpen}
        onOpenChange={setInfoOpen}
        distance={distance}
        onRequestDistance={hasCoords ? () => void measure(true) : null}
        onDirections={() => { setInfoOpen(false); onDirections(); }}
        onOpenMenu={() => { setInfoOpen(false); setMenuOpen(true); }}
        onOpenReviews={() => setReviewsOpen(true)}
      />

      <WalkthroughReviews slug={cafe.slug} cafeName={cafe.name} open={reviewsOpen} onOpenChange={setReviewsOpen} />

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu" description={cafe.name}>
        {sections.map((section) => (
          <div key={section || "menu"} className="mb-4 last:mb-0">
            {section && <h3 className="mb-1 mt-2 text-sm font-bold">{section}</h3>}
            <ul className="divide-y">
              {cafe.menu
                .filter((m) => (m.section ?? "") === section)
                .map((item, i) => (
                  <li key={i} className="flex justify-between gap-4 py-2.5">
                    <span>
                      {item.name}
                      {item.note && <span className="block text-sm text-muted-foreground">{item.note}</span>}
                    </span>
                    {item.price_php !== undefined && <span className="shrink-0 tabular-nums">{formatPhp(item.price_php)}</span>}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </BottomSheet>

      {directions.sheet}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import type { AmenityDefinition } from "@visita/shared-types";
import { Button } from "@/components/ui/button";
import { getDeviceProfile } from "@/lib/splat/device";
import type { WalkthroughCafe } from "@/lib/venue/types";
import { WalkthroughScreen } from "./WalkthroughScreen";

// The walkthrough entry on /cafe/[slug]. Nothing downloads until the visitor
// asks: a scan is tens of megabytes, which matters on mobile data. The open
// walkthrough is a history entry, so the phone's Back button closes it.

interface Props {
  cafe: WalkthroughCafe;
  definitions: AmenityDefinition[];
}

type Stage = "idle" | "confirm" | "unsupported" | "open";

export function CafeWalkthrough({ cafe, definitions }: Props) {
  const profile = useMemo(getDeviceProfile, []);
  const [stage, setStage] = useState<Stage>("idle");
  const pushed = useRef(false);
  const launcher = useRef<HTMLButtonElement>(null);

  const open = () => {
    history.pushState({ walkthrough: cafe.slug }, "");
    pushed.current = true;
    setStage("open");
  };

  const start = () => {
    if (!profile.webgl2) return setStage("unsupported");
    if (profile.lowEnd) return setStage("confirm");
    open();
  };

  // Back closes the walkthrough; closing from the screen pops our entry.
  useEffect(() => {
    const onPop = () => {
      if (pushed.current) {
        pushed.current = false;
        setStage("idle");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const close = () => {
    if (pushed.current) history.back();
    else setStage("idle");
  };

  // Return focus to the launcher after closing.
  useEffect(() => {
    if (stage === "idle") launcher.current?.focus({ preventScroll: true });
  }, [stage]);

  // Keep the page from scrolling behind the full-screen view.
  useEffect(() => {
    if (stage !== "open") return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [stage]);

  return (
    <>
      <section
        aria-label={`3D walkthrough of ${cafe.name}`}
        className="relative grid aspect-[4/3] max-h-[70vh] w-full place-items-center overflow-hidden rounded-2xl bg-scan p-6 text-center text-glass-foreground"
        style={{ backgroundImage: "radial-gradient(circle at 70% 30%, rgba(24,95,165,0.55) 0, transparent 60%)" }}
      >
        <div className="grid max-w-sm justify-items-center gap-3">
          {stage === "unsupported" ? (
            <p>This browser can't show 3D walkthroughs. It needs WebGL 2.</p>
          ) : stage === "confirm" ? (
            <>
              <p>This device may struggle with the walkthrough. It could be slow or close unexpectedly.</p>
              <Button size="lg" onClick={open}>
                Try anyway
              </Button>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-semibold">Walk through {cafe.name}</p>
              <p className="text-sm opacity-80">A real, unedited scan of the room. A quick preview loads first, then full detail.</p>
              <Button ref={launcher} size="lg" onClick={start}>
                Step inside
              </Button>
            </>
          )}
        </div>
      </section>

      {stage === "open" && <WalkthroughScreen cafe={cafe} definitions={definitions} profile={profile} onClose={close} />}
    </>
  );
}

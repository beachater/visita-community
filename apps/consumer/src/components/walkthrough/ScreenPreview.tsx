import { useMemo } from "react";
import type { AmenityDefinition } from "@visita/shared-types";
import { getDeviceProfile } from "@/lib/splat/device";
import type { WalkthroughCafe } from "@/lib/venue/types";
import { WalkthroughScreen } from "./WalkthroughScreen";

// Lab-only: the walkthrough screen already open, for reviewing its layout.
export function ScreenPreview({ cafe, definitions }: { cafe: WalkthroughCafe; definitions: AmenityDefinition[] }) {
  const profile = useMemo(getDeviceProfile, []);
  return <WalkthroughScreen cafe={cafe} definitions={definitions} profile={profile} onClose={() => (location.href = `/cafe/${cafe.slug}`)} />;
}

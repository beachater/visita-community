import type { MenuItem } from "@visita/shared-types";
import { BottomSheet } from "@visita/ui/bottom-sheet";
import { formatPhp } from "@/lib/venue/scan";

// The full menu, grouped by section, from "See full menu".

export function MenuSheet({ cafeName, menu, open, onOpenChange }: { cafeName: string; menu: MenuItem[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const sections = [...new Set(menu.map((m) => m.section ?? ""))];
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Menu" description={cafeName}>
      {sections.map((section) => (
        <div key={section || "menu"} className="mb-4 last:mb-0">
          {section && <h3 className="mb-1 mt-2 text-sm font-bold">{section}</h3>}
          <ul className="divide-y">
            {menu
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
  );
}

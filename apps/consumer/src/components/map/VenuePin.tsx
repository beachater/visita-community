import { cn } from "@visita/ui/utils";

// Map pin, PRD 4.1: scanned cafes are amber (the one meaning of amber:
// scanned and verified), unscanned stay white. A real button, so pins work
// with a keyboard and a screen reader.

interface Props {
  name: string;
  scanned: boolean;
  selected: boolean;
  onSelect: () => void;
}

const pinShape = "M14 35s11-11.2 11-20.5C25 7.6 20.1 3 14 3S3 7.6 3 14.5C3 23.8 14 35 14 35z";

export function VenuePin({ name, scanned, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      aria-label={`${name}${scanned ? ", scanned" : ", not scanned yet"}`}
      aria-pressed={selected}
      className={cn(
        "visita-venue-pin grid size-11 place-items-end justify-center rounded-full transition-transform focus-visible:outline-2 focus-visible:outline-ring",
        selected && "z-10 scale-125",
      )}
    >
      <svg
        width="28"
        height="36"
        viewBox="0 0 28 36"
        aria-hidden="true"
        className="overflow-visible"
        style={{ filter: selected ? "drop-shadow(0 5px 8px rgba(4, 44, 83, 0.6))" : "drop-shadow(0 3px 4px rgba(4, 44, 83, 0.45))" }}
      >
        {selected && <path d={pinShape} fill="none" stroke="var(--brand-cloud)" strokeWidth="7" strokeLinejoin="round" />}
        <path
          d={pinShape}
          fill={scanned ? "var(--verified)" : "#ffffff"}
          stroke="var(--brand-navy)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="14" cy="14.5" r="4" fill="var(--brand-navy)" />
      </svg>
    </button>
  );
}

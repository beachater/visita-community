import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@visita/ui/select";

// A select over a fixed set of values with display labels (status, method, kind).
export function LabelSelect<T extends string>({ id, value, labels, onChange }: { id: string; value: T; labels: Record<T, string>; onChange: (value: T) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(labels) as T[]).map((key) => (
          <SelectItem key={key} value={key}>
            {labels[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

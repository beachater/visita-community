import { cn } from "@visita/ui/utils";
import { STANDING_LABEL, type Standing } from "./billing";

const TONE: Record<Standing, string> = {
  paid: "bg-success/10 text-success",
  due_soon: "bg-warning/15 text-foreground",
  overdue: "bg-destructive/10 text-destructive",
  trial: "bg-accent text-foreground",
  paused: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export function StandingPill({ standing, className }: { standing: Standing; className?: string }) {
  return <span className={cn("inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TONE[standing], className)}>{STANDING_LABEL[standing]}</span>;
}

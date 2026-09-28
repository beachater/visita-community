import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";
import { cn } from "../utils";

// The phone-first panel used across Visita: the menu sheet, reviews, filters,
// pin cards. Rises from the bottom, caps at 85% of the screen, and scrolls its
// own content. Focus trapping, Escape and the backdrop come from Radix.

interface Props {
  title: string;
  description?: string;
  /** Uncontrolled: the element that opens the sheet. */
  trigger?: ReactNode;
  /** Controlled mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pinned below the scrolling content, e.g. a primary action. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ title, description, trigger, open, onOpenChange, footer, children, className }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side="bottom"
        className={cn("mx-auto flex max-h-[85dvh] w-full max-w-2xl flex-col gap-0 rounded-t-2xl p-0", className)}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />
        <SheetHeader className="px-5 pt-3 pb-2 text-left">
          <SheetTitle className="font-display text-xl">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && <div className="border-t px-5 py-3">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}

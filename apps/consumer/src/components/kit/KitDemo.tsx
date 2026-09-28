import { useState } from "react";
import { toast } from "sonner";
import { Heart, Share2, SlidersHorizontal } from "lucide-react";
import { Button } from "@visita/ui/button";
import { Input } from "@visita/ui/input";
import { Label } from "@visita/ui/label";
import { Textarea } from "@visita/ui/textarea";
import { Switch } from "@visita/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@visita/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@visita/ui/dialog";
import { Toaster } from "@visita/ui/sonner";
import { BottomSheet } from "@visita/ui/bottom-sheet";

// Interactive half of the UI kit page (/lab/ui). Example content only.

const MENU = [
  ["Iced Spanish latte", "₱150"],
  ["Americano", "₱110"],
  ["Matcha latte", "₱165"],
  ["Ensaymada", "₱85"],
  ["Tuna melt", "₱195"],
  ["Chicken pesto pasta", "₱245"],
];

export function KitDemo() {
  const [saved, setSaved] = useState(false);
  const [wifi, setWifi] = useState(true);

  return (
    <div className="grid gap-10">
      <Toaster position="top-center" />

      <section className="grid gap-3">
        <h2 className="font-display text-2xl font-semibold text-primary">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Enter 3D walkthrough</Button>
          <Button variant="outline">Get directions</Button>
          <Button variant="secondary">See full menu</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="link">Read the privacy policy</Button>
          <Button variant="destructive">Remove review</Button>
          <Button disabled>Saving…</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={saved ? "Remove from saved" : "Save cafe"}
            aria-pressed={saved}
            onClick={() => {
              setSaved((s) => !s);
              toast(saved ? "Removed from saved" : "Saved Sonny's Coffee + Diner");
            }}
          >
            <Heart className={saved ? "fill-current text-destructive" : ""} />
          </Button>
          <Button variant="outline" size="icon" aria-label="Share" onClick={() => toast.success("Link copied")}>
            <Share2 />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Primary actions are ocean. Amber never appears on a button; it only means "scanned".</p>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl font-semibold text-primary">Sheets and dialogs</h2>
        <div className="flex flex-wrap gap-3">
          <BottomSheet
            title="Menu"
            description="Sonny's Coffee + Diner · example items"
            trigger={<Button variant="outline">Open the menu sheet</Button>}
          >
            <ul className="divide-y">
              {MENU.concat(MENU).map(([name, price], i) => (
                <li key={i} className="flex justify-between gap-4 py-2.5">
                  <span>{name}</span>
                  <span className="tabular-nums">{price}</span>
                </li>
              ))}
            </ul>
          </BottomSheet>

          <BottomSheet
            title="Filters"
            trigger={
              <Button variant="outline">
                <SlidersHorizontal /> Filters
              </Button>
            }
            footer={<Button className="w-full">Show 12 cafes</Button>}
          >
            <div className="grid gap-5">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="kit-wifi">Wi-Fi available</Label>
                <Switch id="kit-wifi" checked={wifi} onCheckedChange={setWifi} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="kit-outlets">Minimum outlets</Label>
                <Select defaultValue="any">
                  <SelectTrigger id="kit-outlets" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="2">2 or more</SelectItem>
                    <SelectItem value="5">5 or more</SelectItem>
                    <SelectItem value="10">10 or more</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </BottomSheet>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open a dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove this review?</DialogTitle>
                <DialogDescription>It disappears from the cafe's page. You can write a new one later.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Keep it</Button>
                <Button variant="destructive">Remove review</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="grid max-w-lg gap-4">
        <h2 className="font-display text-2xl font-semibold text-primary">Form controls</h2>
        <div className="grid gap-2">
          <Label htmlFor="kit-name">Cafe name</Label>
          <Input id="kit-name" defaultValue="Sonny's Coffee + Diner" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="kit-review">Your review</Label>
          <Textarea id="kit-review" placeholder="What was it like? Seats, outlets, noise, the coffee." rows={4} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="kit-occupancy">Right now it's</Label>
          <Select defaultValue="moderate">
            <SelectTrigger id="kit-occupancy" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quiet">Quiet</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="full">Full</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="kit-invalid">Price</Label>
          <Input id="kit-invalid" defaultValue="one twenty" aria-invalid="true" aria-describedby="kit-invalid-msg" />
          <p id="kit-invalid-msg" className="text-sm text-destructive">Enter the price as a number, like 120.</p>
        </div>
      </section>
    </div>
  );
}

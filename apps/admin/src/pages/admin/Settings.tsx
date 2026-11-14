import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@visita/ui/button";
import { Switch } from "@visita/ui/switch";
import { supabase } from "@/lib/supabase";

// Platform settings: switches that change the visitor site without a deploy.
// One row in platform_settings; everyone reads it, only admins can change it.

interface Settings {
  in_app_directions: boolean;
  updated_at: string;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase.from("platform_settings").select("in_app_directions, updated_at").maybeSingle();
    if (error || !data) {
      if (error) console.error("[settings]", error);
      setError("Couldn't load the settings. Try again, or check that the database is up to date.");
      return;
    }
    setSettings(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setInAppDirections = async (on: boolean) => {
    setSaving(true);
    // .select() so a change RLS refused (no rows updated) shows as an error
    // rather than looking saved.
    const { data, error } = await supabase
      .from("platform_settings")
      .update({ in_app_directions: on })
      .eq("id", true)
      .select("in_app_directions, updated_at")
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      if (error) console.error("[settings]", error);
      return toast.error("Couldn't save the setting. Only admins can change it.");
    }
    setSettings(data);
    toast.success(on ? "In-app directions turned on" : "In-app directions turned off");
  };

  return (
    <div className="grid max-w-3xl gap-6">
      <header className="grid gap-1">
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Switches for the visitor site. Changes apply on the next page load, no deploy needed.</p>
      </header>

      {error && (
        <div className="grid justify-items-start gap-3">
          <p role="alert">{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      {!settings && !error && <p className="text-muted-foreground">Loading…</p>}

      {settings && (
        <section className="grid gap-4 rounded-card bg-card p-5 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <label htmlFor="in-app-directions" className="font-medium">
                In-app Google Maps directions
              </label>
              <p id="in-app-directions-help" className="text-sm text-muted-foreground">
                On: "Get directions" shows the route inside Visita, with a button to open Google Maps for turn-by-turn navigation. Off: it opens Google Maps
                (or offers Apple Maps on Apple devices), as before.
              </p>
            </div>
            <Switch
              id="in-app-directions"
              checked={settings.in_app_directions}
              disabled={saving}
              onCheckedChange={(on) => void setInAppDirections(on)}
              aria-describedby="in-app-directions-help"
              className="mt-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">Last changed {when(settings.updated_at)}</p>
        </section>
      )}
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useRuntime } from "@/lib/store";
import { Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function TaskForm() {
  const [url, setUrl] = useState("");
  const [action, setAction] = useState("");
  const [waitFor, setWaitFor] = useState("");
  const [screenshot, setScreenshot] = useState(true);
  const [scroll, setScroll] = useState(false);
  const [headless, setHeadless] = useState(true);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return toast.error("URL requise");
    setLoading(true);
    try {
      const task = await api.createTask({
        url,
        action: action || undefined,
        waitFor: waitFor || undefined,
        screenshot,
        scroll,
        headless,
        timeout: 30000,
        retries: 2,
      });
      useRuntime.getState().upsertHistory(task);
      toast.success(`Tâche créée: ${task.id.slice(0, 8)}`);
      setUrl("");
      setAction("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec backend");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border bg-card p-5 space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="url">URL cible</Label>
        <Input
          id="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="action">Action / instruction (optionnel)</Label>
        <Textarea
          id="action"
          rows={2}
          placeholder="Ex: cliquer sur 'Voir plus', extraire le tableau"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="waitFor">Sélecteur d'attente (optionnel)</Label>
        <Input
          id="waitFor"
          placeholder="table.results, #app, ..."
          value={waitFor}
          onChange={(e) => setWaitFor(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-3 pt-2">
        <ToggleRow label="Screenshot" checked={screenshot} onChange={setScreenshot} />
        <ToggleRow label="Scroll" checked={scroll} onChange={setScroll} />
        <ToggleRow label="Headless" checked={headless} onChange={setHeadless} />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground hover:opacity-90 shadow-[var(--shadow-glow)]"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        Lancer l'analyse
      </Button>
    </form>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2 cursor-pointer">
      <span className="text-xs">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSettings } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Check, Plug } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { apiUrl, apiKey, pollIntervalMs, setApiUrl, setApiKey, setPollInterval } =
    useSettings();
  const [testing, setTesting] = useState(false);

  async function test() {
    setTesting(true);
    try {
      const s = await api.status();
      toast.success(`Backend OK — v${s.version ?? "?"}, ${s.activeTasks} actives`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connexion impossible");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Connexion au backend Playwright distant.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="apiUrl">URL du backend</Label>
          <Input
            id="apiUrl"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:4000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="apiKey">Clé API (Bearer)</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="optionnel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="poll">Intervalle de polling (ms)</Label>
          <Input
            id="poll"
            type="number"
            value={pollIntervalMs}
            onChange={(e) => setPollInterval(Number(e.target.value) || 2000)}
          />
        </div>
        <Button
          onClick={test}
          disabled={testing}
          className="bg-[image:var(--gradient-primary)] text-primary-foreground"
        >
          {testing ? <Plug className="w-4 h-4 animate-pulse" /> : <Check className="w-4 h-4" />}
          Tester la connexion
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-sm space-y-2">
        <h2 className="font-semibold">Contrat API attendu</h2>
        <ul className="text-xs text-muted-foreground space-y-1 font-mono">
          <li>GET  /api/status → BotStatus</li>
          <li>GET  /api/tasks → Task[]</li>
          <li>POST /api/tasks {"{ url, action?, ... }"} → Task</li>
          <li>GET  /api/tasks/:id → Task</li>
          <li>POST /api/tasks/:id/stop → Task</li>
          <li>DEL  /api/tasks/:id → {"{ ok: true }"}</li>
          <li>GET  /api/logs?since=ISO → {"{ logs: LogEntry[] }"}</li>
        </ul>
        <p className="text-xs text-muted-foreground pt-2">
          Code de démarrage complet dans le dossier <code>backend/</code> du projet.
        </p>
      </div>
    </div>
  );
}
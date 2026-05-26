import { createFileRoute } from "@tanstack/react-router";
import { useRuntime } from "@/lib/store";
import { JsonViewer } from "@/components/JsonViewer";
import { Button } from "@/components/ui/button";
import { Download, ImageIcon, FileJson } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

const search = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/results")({
  validateSearch: (s) => search.parse(s),
  component: ResultsPage,
});

function download(filename: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(data: Record<string, unknown>): string {
  const rows: string[] = [];
  const flat = Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)]);
  rows.push("key,value");
  flat.forEach(([k, v]) => rows.push(`"${k}",${v}`));
  return rows.join("\n");
}

function ResultsPage() {
  const { id } = Route.useSearch();
  const history = useRuntime((s) => s.history);
  const task = useMemo(
    () => history.find((t) => t.id === id) ?? history.find((t) => t.result),
    [id, history],
  );

  if (!task) {
    return (
      <div className="max-w-3xl mx-auto rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
        Sélectionne une tâche depuis l'historique pour voir ses résultats.
      </div>
    );
  }

  const result = task.result;
  const screenshot = result?.screenshot;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold truncate">{task.config.url}</h1>
          <p className="text-sm text-muted-foreground">
            {task.id} · {task.status} ·{" "}
            {result ? `${result.durationMs}ms` : "—"}
          </p>
        </div>
        {result && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                download(`${task.id}.json`, JSON.stringify(result, null, 2))
              }
            >
              <FileJson className="w-4 h-4" /> JSON
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                download(`${task.id}.csv`, toCSV(result.data), "text/csv")
              }
            >
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        )}
      </div>

      {task.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {task.error}
        </div>
      )}

      {screenshot && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <ImageIcon className="w-4 h-4" /> Capture d'écran
          </div>
          <img
            src={
              screenshot.startsWith("data:") || screenshot.startsWith("http")
                ? screenshot
                : `data:image/png;base64,${screenshot}`
            }
            alt="screenshot"
            className="rounded-md border border-border max-h-[600px] mx-auto"
          />
        </div>
      )}

      {result && (
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Données extraites
            </h2>
            <JsonViewer data={result.data} />
          </section>
          {result.html && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                HTML récupéré
              </h2>
              <pre className="rounded-lg border border-border bg-[oklch(0.13_0.02_260)] p-4 text-xs font-mono overflow-auto max-h-[520px] text-foreground/80 whitespace-pre-wrap">
                {result.html.slice(0, 20000)}
              </pre>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
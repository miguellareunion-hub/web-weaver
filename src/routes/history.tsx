import { createFileRoute } from "@tanstack/react-router";
import { useRuntime } from "@/lib/store";
import { TaskRow } from "@/components/TaskRow";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const history = useRuntime((s) => s.history);
  const clear = useRuntime((s) => s.clearHistory);
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Historique</h1>
          <p className="text-sm text-muted-foreground">
            {history.length} analyse(s) enregistrée(s) localement.
          </p>
        </div>
        <Button variant="outline" onClick={clear}>
          <Trash2 className="w-4 h-4" /> Vider
        </Button>
      </div>
      <div className="space-y-2">
        {history.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Pas encore d'historique.
          </div>
        )}
        {history.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}
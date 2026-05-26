import { createFileRoute } from "@tanstack/react-router";
import { TaskForm } from "@/components/TaskForm";
import { LogStream } from "@/components/LogStream";
import { StatCard } from "@/components/StatCard";
import { TaskRow } from "@/components/TaskRow";
import { useRuntime } from "@/lib/store";
import { useMemo } from "react";
import { Bot, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const history = useRuntime((s) => s.history);
  const stats = useMemo(() => {
    const running = history.filter((t) => t.status === "running").length;
    const success = history.filter((t) => t.status === "success").length;
    const error = history.filter((t) => t.status === "error").length;
    return { running, success, error, total: history.length };
  }, [history]);
  const recent = history.slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Lance une analyse, surveille le bot en temps réel.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total tâches" value={stats.total} icon={Bot} />
        <StatCard label="En cours" value={stats.running} icon={Loader2} tone="info" />
        <StatCard label="Succès" value={stats.success} icon={CheckCircle2} tone="success" />
        <StatCard label="Erreurs" value={stats.error} icon={AlertTriangle} tone="destructive" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <TaskForm />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Logs temps réel
            </h2>
          </div>
          <LogStream height="h-[360px]" />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tâches récentes
        </h2>
        {recent.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucune tâche. Lance ta première analyse ci-dessus.
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

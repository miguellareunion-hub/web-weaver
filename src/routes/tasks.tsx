import { createFileRoute } from "@tanstack/react-router";
import { TaskForm } from "@/components/TaskForm";
import { TaskRow } from "@/components/TaskRow";
import { useRuntime } from "@/lib/store";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const history = useRuntime((s) => s.history);
  return (
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.5fr] gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-4">Nouvelle tâche</h1>
        <TaskForm />
      </div>
      <div>
        <h2 className="text-2xl font-semibold mb-4">File d'attente</h2>
        <div className="space-y-2">
          {history.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aucune tâche en mémoire.
            </div>
          )}
          {history.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
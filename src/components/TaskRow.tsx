import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useRuntime } from "@/lib/store";
import { Square, Trash2, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusCls: Record<string, string> = {
  queued: "bg-muted text-muted-foreground border-border",
  running: "bg-info/15 text-info border-info/30",
  success: "bg-success/15 text-success border-success/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  stopped: "bg-warning/15 text-warning border-warning/30",
};

export function TaskRow({ task }: { task: Task }) {
  async function stop() {
    try {
      const updated = await api.stopTask(task.id);
      useRuntime.getState().upsertHistory(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stop failed");
    }
  }
  async function remove() {
    try {
      await api.deleteTask(task.id);
      useRuntime.setState((s) => ({
        history: s.history.filter((t) => t.id !== task.id),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
      <span
        className={cn(
          "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border",
          statusCls[task.status],
        )}
      >
        {task.status}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{task.config.url}</div>
        <div className="text-xs text-muted-foreground truncate">
          {task.config.action || "—"} ·{" "}
          {new Date(task.createdAt).toLocaleString()}
        </div>
      </div>
      <div className="hidden md:flex w-32 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-[image:var(--gradient-primary)] transition-all"
          style={{ width: `${Math.round((task.progress || 0) * 100)}%` }}
        />
      </div>
      <div className="flex items-center gap-1">
        <Button asChild size="icon" variant="ghost">
          <Link to="/results" search={{ id: task.id }}>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </Button>
        {task.status === "running" && (
          <Button size="icon" variant="ghost" onClick={stop}>
            <Square className="w-4 h-4 text-warning" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={remove}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
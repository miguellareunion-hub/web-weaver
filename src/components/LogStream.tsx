import { useRuntime } from "@/lib/store";
import { cn } from "@/lib/utils";

const levelClass: Record<string, string> = {
  info: "text-info",
  warn: "text-warning",
  error: "text-destructive",
  debug: "text-muted-foreground",
  success: "text-success",
};

export function LogStream({ height = "h-[420px]" }: { height?: string }) {
  const logs = useRuntime((s) => s.logs);
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-[oklch(0.13_0.02_260)] font-mono text-xs overflow-auto",
        height,
      )}
    >
      {logs.length === 0 ? (
        <div className="p-4 text-muted-foreground">
          En attente de logs du backend…
        </div>
      ) : (
        <ul className="divide-y divide-border/40">
          {logs.map((log) => (
            <li key={log.id} className="px-4 py-1.5 flex gap-3">
              <span className="text-muted-foreground shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  "uppercase shrink-0 w-14",
                  levelClass[log.level] ?? "text-foreground",
                )}
              >
                {log.level}
              </span>
              <span className="text-foreground/90 break-all">
                {log.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
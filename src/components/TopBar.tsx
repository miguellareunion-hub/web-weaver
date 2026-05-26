import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { useSettings } from "@/lib/store";
import { cn } from "@/lib/utils";

export function TopBar() {
  const apiUrl = useSettings((s) => s.apiUrl);
  const { data, isError } = useQuery({
    queryKey: ["bot-status", apiUrl],
    queryFn: () => api.status(),
    refetchInterval: 3000,
    retry: false,
  });

  const online = !!data?.online && !isError;

  return (
    <header className="h-14 shrink-0 flex items-center gap-4 px-5 border-b border-border bg-card/50 backdrop-blur">
      <div className="text-sm text-muted-foreground truncate">
        Backend&nbsp;
        <code className="text-foreground/80">{apiUrl}</code>
      </div>
      <div className="ml-auto flex items-center gap-3 text-xs">
        <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
          <Activity className="w-3.5 h-3.5" />
          {data?.activeTasks ?? 0} actives · {data?.queuedTasks ?? 0} en file
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
            online
              ? "border-success/30 bg-success/10 text-success"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {online ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          {online ? "En ligne" : "Hors ligne"}
        </div>
      </div>
    </header>
  );
}
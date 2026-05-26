import { createFileRoute } from "@tanstack/react-router";
import { LogStream } from "@/components/LogStream";
import { Button } from "@/components/ui/button";
import { useRuntime } from "@/lib/store";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/logs")({
  component: LogsPage,
});

function LogsPage() {
  const clearLogs = useRuntime((s) => s.clearLogs);
  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Console temps réel</h1>
          <p className="text-sm text-muted-foreground">
            Flux des logs émis par le backend Playwright.
          </p>
        </div>
        <Button variant="outline" onClick={clearLogs}>
          <Trash2 className="w-4 h-4" /> Vider
        </Button>
      </div>
      <LogStream height="h-[calc(100vh-220px)]" />
    </div>
  );
}
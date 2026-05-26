import { useEffect } from "react";
import { useSettings, useRuntime } from "@/lib/store";
import { api } from "@/lib/api";

/**
 * Polls backend for live logs + task updates and feeds zustand stores.
 * Mount once at the layout level.
 */
export function useBotPolling() {
  const interval = useSettings((s) => s.pollIntervalMs);
  const apiUrl = useSettings((s) => s.apiUrl);

  useEffect(() => {
    let cancelled = false;
    let lastLogTs: string | undefined;

    async function tick() {
      try {
        const [{ logs }, tasks] = await Promise.all([
          api.logs(lastLogTs),
          api.listTasks(),
        ]);
        if (cancelled) return;
        const { pushLog, upsertHistory } = useRuntime.getState();
        for (const log of [...logs].reverse()) {
          pushLog(log);
          lastLogTs = log.timestamp;
        }
        for (const t of tasks) upsertHistory(t);
      } catch {
        // backend offline — ignore until next tick
      }
    }

    tick();
    const id = setInterval(tick, Math.max(500, interval));
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [interval, apiUrl]);
}
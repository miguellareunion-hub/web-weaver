import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LogEntry, Task } from "./types";

interface SettingsState {
  apiUrl: string;
  apiKey: string;
  pollIntervalMs: number;
  setApiUrl: (v: string) => void;
  setApiKey: (v: string) => void;
  setPollInterval: (v: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      apiUrl: "http://localhost:4000",
      apiKey: "",
      pollIntervalMs: 2000,
      setApiUrl: (apiUrl) => set({ apiUrl }),
      setApiKey: (apiKey) => set({ apiKey }),
      setPollInterval: (pollIntervalMs) => set({ pollIntervalMs }),
    }),
    { name: "scrapebot-settings" },
  ),
);

interface RuntimeState {
  logs: LogEntry[];
  history: Task[];
  pushLog: (log: LogEntry) => void;
  clearLogs: () => void;
  upsertHistory: (task: Task) => void;
  clearHistory: () => void;
}

export const useRuntime = create<RuntimeState>()(
  persist(
    (set) => ({
      logs: [],
      history: [],
      pushLog: (log) =>
        set((s) => ({ logs: [log, ...s.logs].slice(0, 1000) })),
      clearLogs: () => set({ logs: [] }),
      upsertHistory: (task) =>
        set((s) => {
          const existing = s.history.findIndex((t) => t.id === task.id);
          const next = [...s.history];
          if (existing >= 0) next[existing] = task;
          else next.unshift(task);
          return { history: next.slice(0, 200) };
        }),
      clearHistory: () => set({ history: [] }),
    }),
    { name: "scrapebot-runtime", partialize: (s) => ({ history: s.history }) },
  ),
);
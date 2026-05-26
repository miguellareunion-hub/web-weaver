import { useSettings } from "./store";
import type { BotStatus, Task, TaskConfig } from "./types";

function headers(): HeadersInit {
  const { apiKey } = useSettings.getState();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) h["Authorization"] = `Bearer ${apiKey}`;
  return h;
}

function base(): string {
  return useSettings.getState().apiUrl.replace(/\/$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  status: () => request<BotStatus>("/api/status"),
  listTasks: () => request<Task[]>("/api/tasks"),
  getTask: (id: string) => request<Task>(`/api/tasks/${id}`),
  createTask: (config: TaskConfig) =>
    request<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(config),
    }),
  stopTask: (id: string) =>
    request<Task>(`/api/tasks/${id}/stop`, { method: "POST" }),
  deleteTask: (id: string) =>
    request<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),
  logs: (since?: string) =>
    request<{ logs: import("./types").LogEntry[] }>(
      `/api/logs${since ? `?since=${encodeURIComponent(since)}` : ""}`,
    ),
};
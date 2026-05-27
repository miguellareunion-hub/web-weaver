import { useSettings } from "./store";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  screenshot?: string;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatStatus {
  connected: boolean;
  url: string;
  lastConnectedAt: string | null;
  settings: {
    headless: boolean;
    timeout: number;
    retries: number;
    screenshot: boolean;
    autoReconnect: boolean;
  };
}

function base() {
  return useSettings.getState().apiUrl.replace(/\/$/, "");
}
function headers(): HeadersInit {
  const { apiKey } = useSettings.getState();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) h["Authorization"] = `Bearer ${apiKey}`;
  return h;
}
async function req<T>(p: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${base()}${p}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => r.statusText)}`);
  return r.json() as Promise<T>;
}

export const chatApi = {
  status: () => req<ChatStatus>("/api/chat/status"),
  updateSettings: (s: Partial<ChatStatus["settings"]>) =>
    req<ChatStatus["settings"]>("/api/chat/settings", {
      method: "POST",
      body: JSON.stringify(s),
    }),
  connect: (url: string) =>
    req<ChatStatus>("/api/chat/connect", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  disconnect: () =>
    req<{ ok: true }>("/api/chat/disconnect", { method: "POST" }),
  list: () => req<ConversationSummary[]>("/api/chat/conversations"),
  get: (id: string) => req<Conversation>(`/api/chat/conversations/${id}`),
  create: (data: { title?: string; url?: string }) =>
    req<Conversation>("/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    req<{ ok: true }>(`/api/chat/conversations/${id}`, { method: "DELETE" }),
  send: (id: string, prompt: string, url?: string) =>
    req<{ ok: true }>(`/api/chat/conversations/${id}/message`, {
      method: "POST",
      body: JSON.stringify({ prompt, url }),
    }),
};

export function chatWsUrl(): string {
  const u = base().replace(/^http/, "ws");
  return `${u}/ws`;
}

export function resolveScreenshot(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${base()}${url}`;
}
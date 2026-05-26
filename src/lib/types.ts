export type TaskStatus = "queued" | "running" | "success" | "error" | "stopped";

export type LogLevel = "info" | "warn" | "error" | "debug" | "success";

export interface LogEntry {
  id: string;
  taskId?: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface ScrapeRule {
  name: string;
  selector: string;
  type: "text" | "html" | "attr" | "list" | "table";
  attr?: string;
}

export interface TaskConfig {
  url: string;
  action?: string;
  rules?: ScrapeRule[];
  waitFor?: string;
  clicks?: string[];
  scroll?: boolean;
  screenshot?: boolean;
  headless?: boolean;
  timeout?: number;
  retries?: number;
}

export interface Task {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: TaskStatus;
  config: TaskConfig;
  progress: number;
  currentUrl?: string;
  error?: string;
  result?: ScrapeResult;
}

export interface ScrapeResult {
  taskId: string;
  url: string;
  finishedAt: string;
  durationMs: number;
  html?: string;
  screenshot?: string; // base64 or URL
  data: Record<string, unknown>;
  tables?: unknown[][];
  images?: string[];
  stats?: Record<string, number>;
}

export interface BotStatus {
  online: boolean;
  version?: string;
  activeTasks: number;
  queuedTasks: number;
  uptimeMs?: number;
}
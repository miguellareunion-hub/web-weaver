import { randomUUID } from "node:crypto";
import { broadcast } from "./chat/ws.js";

const MAX = 2000;
const buffer = [];

export function log(level, message, taskId) {
  const entry = {
    id: randomUUID(),
    taskId,
    timestamp: new Date().toISOString(),
    level,
    message: String(message),
  };
  buffer.push(entry);
  if (buffer.length > MAX) buffer.shift();
  const fn = level === "error" ? console.error : console.log;
  fn(`[${entry.timestamp}] ${level.toUpperCase()} ${taskId ?? "-"} ${message}`);
  try { broadcast({ type: "log", log: entry }); } catch {}
  return entry;
}

export function getLogs(sinceIso) {
  if (!sinceIso) return buffer.slice(-200);
  return buffer.filter((l) => l.timestamp > sinceIso);
}
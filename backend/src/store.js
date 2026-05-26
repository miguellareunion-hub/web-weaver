import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || "./data";
await fs.mkdir(DATA_DIR, { recursive: true });

const tasks = new Map();

export function createTask(config) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const task = {
    id,
    createdAt: now,
    updatedAt: now,
    status: "queued",
    config,
    progress: 0,
  };
  tasks.set(id, task);
  return task;
}

export function updateTask(id, patch) {
  const t = tasks.get(id);
  if (!t) return null;
  const updated = { ...t, ...patch, updatedAt: new Date().toISOString() };
  tasks.set(id, updated);
  return updated;
}

export function getTask(id) {
  return tasks.get(id) ?? null;
}

export function listTasks() {
  return [...tasks.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function deleteTask(id) {
  return tasks.delete(id);
}

export async function persistResult(task) {
  const file = path.join(DATA_DIR, `${task.id}.json`);
  await fs.writeFile(file, JSON.stringify(task, null, 2));
  return file;
}

export function stats() {
  let active = 0;
  let queued = 0;
  for (const t of tasks.values()) {
    if (t.status === "running") active++;
    if (t.status === "queued") queued++;
  }
  return { active, queued, total: tasks.size };
}
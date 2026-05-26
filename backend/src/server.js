import express from "express";
import cors from "cors";
import {
  createTask,
  getTask,
  listTasks,
  deleteTask,
  stats,
} from "./store.js";
import { runTask, stopTask } from "./bot.js";
import { getLogs, log } from "./logger.js";

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const STARTED = Date.now();

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "2mb" }));

// Optional auth
app.use((req, res, next) => {
  if (!API_KEY) return next();
  const auth = req.headers.authorization || "";
  if (auth === `Bearer ${API_KEY}`) return next();
  res.status(401).json({ error: "unauthorized" });
});

app.get("/api/status", (_req, res) => {
  const s = stats();
  res.json({
    online: true,
    version: "0.1.0",
    activeTasks: s.active,
    queuedTasks: s.queued,
    uptimeMs: Date.now() - STARTED,
  });
});

app.get("/api/tasks", (_req, res) => res.json(listTasks()));
app.get("/api/tasks/:id", (req, res) => {
  const t = getTask(req.params.id);
  if (!t) return res.status(404).json({ error: "not found" });
  res.json(t);
});

app.post("/api/tasks", (req, res) => {
  const body = req.body || {};
  if (!body.url || typeof body.url !== "string") {
    return res.status(400).json({ error: "url required" });
  }
  const task = createTask(body);
  log("info", `Task queued: ${body.url}`, task.id);
  // fire and forget
  runTask(task);
  res.status(201).json(task);
});

app.post("/api/tasks/:id/stop", (req, res) => {
  const t = getTask(req.params.id);
  if (!t) return res.status(404).json({ error: "not found" });
  stopTask(t.id);
  log("warn", "Stop requested", t.id);
  res.json(getTask(t.id));
});

app.delete("/api/tasks/:id", (req, res) => {
  stopTask(req.params.id);
  const ok = deleteTask(req.params.id);
  res.json({ ok });
});

app.get("/api/logs", (req, res) => {
  const since = typeof req.query.since === "string" ? req.query.since : undefined;
  res.json({ logs: getLogs(since) });
});

app.listen(PORT, () => {
  log("info", `ScrapeBot backend listening on :${PORT}`);
});
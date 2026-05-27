import express from "express";
import cors from "cors";
import http from "node:http";
import {
  createTask,
  getTask,
  listTasks,
  deleteTask,
  stats,
} from "./store.js";
import { runTask, stopTask } from "./bot.js";
import { getLogs, log } from "./logger.js";
import {
  listConversations,
  getConversation,
  createConversation,
  appendMessage,
  deleteConversation,
} from "./chat/history.js";
import {
  sendPrompt,
  connect as chatConnect,
  getStatus as chatStatus,
  updateSettings as updateChatSettings,
  closeBrowser as closeChatBrowser,
  readScreenshot,
} from "./chat/playwrightChat.js";
import { initWs, broadcast } from "./chat/ws.js";

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

// --- AI Chat (Playwright) ---
app.get("/api/chat/status", (_req, res) => res.json(chatStatus()));

app.post("/api/chat/settings", (req, res) => {
  res.json(updateChatSettings(req.body || {}));
});

app.post("/api/chat/connect", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "url required" });
    const status = await chatConnect(url);
    broadcast({ type: "chat:status", status });
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/chat/disconnect", async (_req, res) => {
  await closeChatBrowser();
  broadcast({ type: "chat:status", status: chatStatus() });
  res.json({ ok: true });
});

app.get("/api/chat/conversations", (_req, res) =>
  res.json(listConversations()),
);

app.post("/api/chat/conversations", (req, res) => {
  const conv = createConversation(req.body || {});
  res.status(201).json(conv);
});

app.get("/api/chat/conversations/:id", (req, res) => {
  const c = getConversation(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
});

app.delete("/api/chat/conversations/:id", async (req, res) => {
  await deleteConversation(req.params.id);
  res.json({ ok: true });
});

app.post("/api/chat/conversations/:id/message", async (req, res) => {
  const conv = getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: "not found" });
  const { prompt, url } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  const userMsg = await appendMessage(conv.id, { role: "user", content: prompt });
  broadcast({ type: "chat:message", convId: conv.id, message: userMsg });
  broadcast({ type: "chat:typing", convId: conv.id, typing: true });

  res.json({ ok: true, message: userMsg });

  try {
    const target = url || conv.url;
    const { response, screenshot } = await sendPrompt({
      url: target,
      prompt,
      convId: conv.id,
      onScreenshot: (s) =>
        broadcast({ type: "chat:screenshot", convId: conv.id, url: s }),
    });
    if (target && target !== conv.url) {
      conv.url = target;
    }
    const botMsg = await appendMessage(conv.id, {
      role: "assistant",
      content: response,
      screenshot,
    });
    broadcast({ type: "chat:message", convId: conv.id, message: botMsg });
  } catch (e) {
    const errMsg = await appendMessage(conv.id, {
      role: "assistant",
      content: `⚠️ Erreur: ${e.message}`,
      error: true,
    });
    broadcast({ type: "chat:message", convId: conv.id, message: errMsg });
  } finally {
    broadcast({ type: "chat:typing", convId: conv.id, typing: false });
  }
});

app.get("/api/chat/screenshots/:filename", async (req, res) => {
  try {
    const buf = await readScreenshot(req.params.filename);
    res.type("png").send(buf);
  } catch {
    res.status(404).end();
  }
});

const server = http.createServer(app);
initWs(server);
server.listen(PORT, () => {
  log("info", `ScrapeBot backend listening on :${PORT}`);
  log("info", `WebSocket: ws://localhost:${PORT}/ws`);
});
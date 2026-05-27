import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";
const CHAT_DIR = path.join(DATA_DIR, "chats");
await fs.mkdir(CHAT_DIR, { recursive: true });

const conversations = new Map();

async function loadAll() {
  try {
    const files = await fs.readdir(CHAT_DIR);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(CHAT_DIR, f), "utf8");
        const conv = JSON.parse(raw);
        conversations.set(conv.id, conv);
      } catch {}
    }
  } catch {}
}
await loadAll();

async function persist(conv) {
  await fs.writeFile(
    path.join(CHAT_DIR, `${conv.id}.json`),
    JSON.stringify(conv, null, 2),
  );
}

export function listConversations() {
  return [...conversations.values()]
    .map((c) => ({
      id: c.id,
      title: c.title,
      url: c.url,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getConversation(id) {
  return conversations.get(id) ?? null;
}

export function createConversation({ title, url }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const conv = {
    id,
    title: title || "Nouvelle conversation",
    url: url || "",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  conversations.set(id, conv);
  persist(conv).catch(() => {});
  return conv;
}

export async function appendMessage(id, message) {
  const conv = conversations.get(id);
  if (!conv) return null;
  const msg = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...message,
  };
  conv.messages.push(msg);
  conv.updatedAt = msg.timestamp;
  if (conv.messages.length === 1 && message.role === "user") {
    conv.title = message.content.slice(0, 60);
  }
  await persist(conv).catch(() => {});
  return msg;
}

export async function deleteConversation(id) {
  conversations.delete(id);
  await fs.unlink(path.join(CHAT_DIR, `${id}.json`)).catch(() => {});
  return true;
}
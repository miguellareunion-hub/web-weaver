import { WebSocketServer } from "ws";

let wss = null;

export function initWs(server) {
  wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));
  });
  return wss;
}

export function broadcast(event) {
  if (!wss) return;
  const msg = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      try { client.send(msg); } catch {}
    }
  }
}
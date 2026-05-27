import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/store";
import { chatWsUrl, type ChatMessage } from "@/lib/chatApi";
import { useRuntime } from "@/lib/store";

type Handler = (event: WsEvent) => void;

export type WsEvent =
  | { type: "hello"; ts: number }
  | { type: "log"; log: import("@/lib/types").LogEntry }
  | { type: "chat:message"; convId: string; message: ChatMessage }
  | { type: "chat:typing"; convId: string; typing: boolean }
  | { type: "chat:screenshot"; convId: string; url: string }
  | { type: "chat:status"; status: unknown };

export function useChatWs(handler: Handler) {
  const apiUrl = useSettings((s) => s.apiUrl);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    function open() {
      try {
        ws = new WebSocket(chatWsUrl());
      } catch {
        retry = setTimeout(open, 3000);
        return;
      }
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as WsEvent;
          if (data.type === "log") {
            useRuntime.getState().pushLog(data.log);
          }
          handlerRef.current(data);
        } catch {}
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(open, 2000);
      };
      ws.onerror = () => ws?.close();
    }
    open();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [apiUrl]);
}
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  chatApi,
  resolveScreenshot,
  resolveAttachment,
  type ChatMessage,
  type Conversation,
  type ConversationSummary,
  type ChatStatus,
} from "@/lib/chatApi";
import { useChatWs } from "@/hooks/useChatWs";
import { toast } from "sonner";
import {
  Plus,
  Send,
  Trash2,
  Download,
  Plug,
  PlugZap,
  Loader2,
  Bot,
  User,
  Image as ImageIcon,
  Paperclip,
  X as XIcon,
  FileIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

const PRESETS = [
  "https://chat.openai.com",
  "https://gemini.google.com/app",
  "https://claude.ai/new",
  "https://chat.mistral.ai",
];

function ChatPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [url, setUrl] = useState(PRESETS[0]);
  const [prompt, setPrompt] = useState("");
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function reloadList() {
    try {
      const list = await chatApi.list();
      setConversations(list);
      return list;
    } catch (e) {
      console.warn(e);
      return [];
    }
  }

  async function reloadStatus() {
    try {
      const s = await chatApi.status();
      setStatus(s);
      if (s.url) setUrl(s.url);
    } catch {}
  }

  useEffect(() => {
    reloadStatus();
    reloadList().then(async (list) => {
      if (list.length) {
        const full = await chatApi.get(list[0].id);
        setActive(full);
        if (full.url) setUrl(full.url);
      }
    });
  }, []);

  useChatWs((ev) => {
    if (ev.type === "chat:message" && active && ev.convId === active.id) {
      setActive((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, ev.message] }
          : prev,
      );
      reloadList();
    } else if (ev.type === "chat:typing" && active && ev.convId === active.id) {
      setTyping(ev.typing);
      if (!ev.typing) setBusy(false);
    } else if (ev.type === "chat:status") {
      reloadStatus();
    }
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [active?.messages.length, typing]);

  async function newConv() {
    try {
      const c = await chatApi.create({ url });
      setActive(c);
      await reloadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function selectConv(id: string) {
    try {
      const c = await chatApi.get(id);
      setActive(c);
      if (c.url) setUrl(c.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function removeConv(id: string) {
    await chatApi.remove(id);
    if (active?.id === id) setActive(null);
    await reloadList();
  }

  async function exportConv() {
    if (!active) return;
    const blob = new Blob([JSON.stringify(active, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${active.title || active.id}.json`;
    a.click();
  }

  async function connect() {
    if (!url) return;
    try {
      const s = await chatApi.connect(url);
      setStatus(s);
      toast.success(`Connecté à ${url}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connexion impossible");
    }
  }

  async function send() {
    if (!prompt.trim() && files.length === 0) return;
    let conv = active;
    if (!conv) {
      conv = await chatApi.create({ url });
      setActive(conv);
    }
    setBusy(true);
    setTyping(true);
    const p = prompt;
    const f = files;
    setPrompt("");
    setFiles([]);
    try {
      if (f.length > 0) {
        await chatApi.sendWithFiles(conv.id, p, url, f);
      } else {
        await chatApi.send(conv.id, p, url);
      }
      await reloadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible");
      setBusy(false);
      setTyping(false);
    }
  }

  const connected = status?.connected;

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)] max-w-[1600px] mx-auto">
      {/* Conversations sidebar */}
      <aside className="w-64 shrink-0 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border">
          <Button onClick={newConv} className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground">
            <Plus className="w-4 h-4" /> Nouvelle conversation
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {conversations.length === 0 && (
            <div className="text-xs text-muted-foreground p-3">
              Aucune conversation.
            </div>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group rounded-md px-2 py-2 cursor-pointer flex items-start gap-2",
                active?.id === c.id
                  ? "bg-sidebar-accent"
                  : "hover:bg-sidebar-accent/60",
              )}
              onClick={() => selectConv(c.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{c.title}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {c.messageCount} msg · {new Date(c.updatedAt).toLocaleTimeString()}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeConv(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main chat column */}
      <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden min-w-0">
        {/* URL bar */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://chat.openai.com"
              className="flex-1"
            />
            <Button variant="outline" onClick={connect}>
              {connected ? <PlugZap className="w-4 h-4 text-success" /> : <Plug className="w-4 h-4" />}
              {connected ? "Reconnecter" : "Connecter"}
            </Button>
            {active && (
              <Button variant="outline" onClick={exportConv}>
                <Download className="w-4 h-4" /> Export
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5",
                connected
                  ? "border-success/40 text-success"
                  : "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  connected ? "bg-success animate-pulse" : "bg-muted-foreground",
                )}
              />
              {connected ? "En ligne" : "Hors ligne"}
            </Badge>
            {status?.url && (
              <span className="text-muted-foreground truncate">
                Site : <span className="text-foreground">{status.url}</span>
              </span>
            )}
            {status?.lastConnectedAt && (
              <span className="text-muted-foreground ml-auto">
                Dernière connexion : {new Date(status.lastConnectedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setUrl(p)}
                className="text-[11px] px-2 py-0.5 rounded bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground"
              >
                {p.replace(/^https?:\/\//, "")}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4">
          {!active || active.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
              <Bot className="w-10 h-10 mb-2 opacity-60" />
              <p className="text-sm">
                Démarre la conversation en envoyant un message ci-dessous.
              </p>
              <p className="text-xs mt-1">
                Le bot Playwright ouvrira <span className="text-foreground">{url}</span> et y enverra ton prompt.
              </p>
            </div>
          ) : (
            active.messages.map((m) => <MessageBubble key={m.id} m={m} />)
          )}
          {typing && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-[image:var(--gradient-primary)] grid place-items-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Le bot interroge l'IA…
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="p-3 border-t border-border">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs"
                >
                  <FileIcon className="w-3 h-3 text-muted-foreground" />
                  <span className="truncate max-w-[180px]">{f.name}</span>
                  <span className="text-muted-foreground">
                    {(f.size / 1024).toFixed(0)}ko
                  </span>
                  <button
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files || []);
                if (list.length) setFiles((cur) => [...cur, ...list]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-[60px] w-[44px] shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              title="Joindre des fichiers"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Écris ton prompt… (Entrée pour envoyer, Shift+Entrée pour saut de ligne)"
              className="min-h-[60px] max-h-[200px] resize-none"
              disabled={busy}
            />
            <Button
              onClick={send}
              disabled={busy || (!prompt.trim() && files.length === 0)}
              className="bg-[image:var(--gradient-primary)] text-primary-foreground h-[60px] px-5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m }: { m: ChatMessage }) {
  const isUser = m.role === "user";
  return (
    <div className={cn("flex gap-3 items-start", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full grid place-items-center shrink-0",
          isUser
            ? "bg-secondary text-secondary-foreground"
            : "bg-[image:var(--gradient-primary)] text-primary-foreground",
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={cn("max-w-[78%] space-y-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm break-words",
            isUser
              ? "bg-primary/15 text-foreground rounded-tr-sm"
              : m.error
              ? "bg-destructive/10 text-destructive rounded-tl-sm border border-destructive/30"
              : "bg-muted text-foreground rounded-tl-sm",
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{m.content}</div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-[oklch(0.13_0.02_260)] prose-pre:border prose-pre:border-border prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {m.attachments && m.attachments.length > 0 && (
          <div className={cn("flex flex-wrap gap-1.5", isUser && "justify-end")}>
            {m.attachments.map((a, i) => (
              <a
                key={i}
                href={resolveAttachment(a.url)}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-border bg-card hover:bg-muted text-foreground"
              >
                <Download className="w-3 h-3" />
                {a.name}
              </a>
            ))}
          </div>
        )}
        {m.screenshot && (
          <a
            href={resolveScreenshot(m.screenshot)}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
          >
            <ImageIcon className="w-3 h-3" /> capture
          </a>
        )}
        <div
          className={cn(
            "text-[10px] text-muted-foreground",
            isUser ? "text-right" : "text-left",
          )}
        >
          {new Date(m.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
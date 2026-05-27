import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Terminal,
  Database,
  History,
  ListChecks,
  Settings,
  Bot,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/tasks", label: "Tâches", icon: ListChecks },
  { to: "/logs", label: "Logs", icon: Terminal },
  { to: "/results", label: "Résultats", icon: Database },
  { to: "/history", label: "Historique", icon: History },
  { to: "/settings", label: "Paramètres", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="grid place-items-center w-9 h-9 rounded-md bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-sidebar-foreground leading-none">
            ScrapeBot
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Playwright Console
          </div>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {items.map((it) => {
          const active =
            it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <it.icon className="w-4 h-4" />
              {it.label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[var(--shadow-glow)]" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border text-[11px] text-muted-foreground">
        v0.1 · Local-first
      </div>
    </aside>
  );
}
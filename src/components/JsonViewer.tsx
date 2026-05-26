export function JsonViewer({ data }: { data: unknown }) {
  return (
    <pre className="rounded-lg border border-border bg-[oklch(0.13_0.02_260)] p-4 text-xs font-mono overflow-auto max-h-[520px] text-foreground/90 whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
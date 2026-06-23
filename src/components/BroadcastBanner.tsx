import { useState } from "react";
import { X, Megaphone } from "lucide-react";
import { useActiveBroadcasts } from "@/hooks/useBroadcasts";

const KEY = "cria-broadcasts-dismissed";
const getDismissed = (): string[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};

export function BroadcastBanner({ audience }: { audience: "criadora" | "social" }) {
  const { broadcasts } = useActiveBroadcasts();
  const [dismissed, setDismissed] = useState<string[]>(getDismissed);

  const next = broadcasts.find(
    (b) => (b.audience === "todos" || b.audience === audience) && !dismissed.includes(b.id),
  );
  if (!next) return null;

  const dismiss = () => {
    const d = [...dismissed, next.id];
    setDismissed(d);
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* noop */ }
  };

  return (
    <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3 flex items-start gap-3">
      <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Megaphone className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        {next.title && <p className="text-sm font-display font-bold text-foreground">{next.title}</p>}
        <p className="text-sm text-foreground/80 font-body break-words leading-snug">{next.message}</p>
      </div>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground shrink-0 p-0.5" aria-label="Dispensar recado">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

import { useState } from "react";
import { Upload, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUploadProgress } from "@/contexts/UploadProgressContext";

/**
 * Indicador discreto que aparece no header só quando há uploads em curso.
 * Mostra o maior % em andamento; ao clicar, popover lista cada upload.
 * Some sozinho ~4s após o último concluir (timeout no context).
 */
export function UploadProgressIndicator() {
  const { uploads } = useUploadProgress();
  const [open, setOpen] = useState(false);

  if (uploads.length === 0) return null;

  const active = uploads.filter((u) => u.status === "uploading");
  const hasError = uploads.some((u) => u.status === "error");
  const allDone = active.length === 0 && uploads.every((u) => u.status === "done");
  // Maior % entre os ativos (ou 100 se já não há ativos)
  const headlinePct = active.length > 0
    ? Math.max(...active.map((u) => u.pct))
    : 100;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            active.length > 0
              ? `Enviando ${active.length} arquivo(s), ${headlinePct}%`
              : hasError
                ? "Falha em um envio"
                : "Envios concluídos"
          }
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl hover:bg-accent/60 transition-colors text-xs font-body"
        >
          {active.length > 0 ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : hasError ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : allDone ? (
            <Check className="h-4 w-4 text-secondary" />
          ) : (
            <Upload className="h-4 w-4 text-muted-foreground" />
          )}
          {active.length > 0 && (
            <span className="text-[11px] font-semibold text-primary tabular-nums">{headlinePct}%</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 rounded-xl">
        <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground mb-2">
          {active.length > 0 ? `Enviando ${active.length}` : "Envios"}
        </p>
        <ul className="space-y-2">
          {uploads.map((u) => (
            <li key={u.id} className="space-y-1 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-body text-foreground truncate flex-1 min-w-0">{u.fileName}</span>
                <span className="text-[11px] font-body font-semibold tabular-nums shrink-0">
                  {u.status === "error" ? (
                    <span className="text-destructive">falhou</span>
                  ) : u.status === "done" ? (
                    <span className="text-secondary">100%</span>
                  ) : (
                    <span className="text-primary">{u.pct}%</span>
                  )}
                </span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={
                    u.status === "error"
                      ? "h-full bg-destructive transition-all"
                      : u.status === "done"
                        ? "h-full bg-secondary transition-all"
                        : "h-full bg-primary transition-all"
                  }
                  style={{ width: `${u.pct}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        {active.length > 0 && (
          <p className="text-[10px] text-muted-foreground font-body mt-3">
            Não feche a aba enquanto os envios não terminam.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

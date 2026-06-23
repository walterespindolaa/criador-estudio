import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, CheckCircle2 } from "lucide-react";

type AppLog = {
  id: string;
  level: string;
  message: string;
  context: Record<string, unknown> | null;
  url: string | null;
  user_id: string | null;
  created_at: string;
};

const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;

const LEVEL_STYLE: Record<string, string> = {
  error: "bg-red-100 text-red-700",
  warn: "bg-amber-100 text-amber-700",
  info: "bg-blue-100 text-blue-700",
};

export function AdminLogs() {
  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<AppLog[]>({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data, error } = await sbFrom("app_logs")
        .select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AppLog[];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground font-body">Erros capturados automaticamente do app — mais recentes primeiro.</p>
        <button
          onClick={() => refetch()}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-body font-medium rounded-lg border border-border px-3 py-1.5 hover:bg-muted transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground font-body py-6 text-center">Carregando…</p>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Nenhum erro registrado</p>
          <p className="text-xs text-muted-foreground mt-1">Quando algo quebrar no app, aparece aqui automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${LEVEL_STYLE[l.level] ?? "bg-muted text-muted-foreground"}`}>{l.level}</span>
                <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(l.created_at), { locale: ptBR, addSuffix: true })}</span>
              </div>
              <p className="text-sm font-medium text-foreground break-words">{l.message}</p>
              {l.url && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{l.url}</p>}
              {l.context && (
                <details className="mt-1.5">
                  <summary className="text-[11px] text-primary cursor-pointer">detalhes</summary>
                  <pre className="text-[10px] text-muted-foreground bg-muted/40 rounded-lg p-2 mt-1 overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(l.context, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

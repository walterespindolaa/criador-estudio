import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, UserPlus, Activity, FileText, Lightbulb, CalendarRange, Handshake, ListTodo, CheckCircle2, type LucideIcon } from "lucide-react";

type Usage = {
  posts: number; published_posts: number; ideas: number; cronogramas: number;
  collabs: number; tasks: number; new_7d: number; new_30d: number; active_7d: number;
};

const sbRpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 h-full">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-body">{label}</span>
      </div>
      <p className="text-2xl font-display font-extrabold text-foreground">{value ?? 0}</p>
    </div>
  );
}

export function AdminGrowth() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<Usage>({
    queryKey: ["admin-usage"],
    queryFn: async () => {
      const { data, error } = await sbRpc("get_admin_usage");
      if (error) throw error;
      return data as Usage;
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground font-body">Crescimento de contas e uso do produto.</p>
        <button onClick={() => refetch()} className="shrink-0 inline-flex items-center gap-1.5 text-xs font-body font-medium rounded-lg border border-border px-3 py-1.5 hover:bg-muted transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground font-body py-6 text-center">Carregando…</p>
      ) : error || !data ? (
        <div className="rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive font-body">
          Não consegui carregar as métricas. Confira se o SQL <code>get_admin_usage</code> foi rodado.
        </div>
      ) : (
        <>
          <div>
            <p className="text-sm font-display font-semibold text-foreground mb-2">Crescimento</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
              <Stat icon={UserPlus} label="Novos (7 dias)" value={data.new_7d} />
              <Stat icon={UserPlus} label="Novos (30 dias)" value={data.new_30d} />
              <Stat icon={Activity} label="Ativos (7 dias)" value={data.active_7d} />
            </div>
          </div>

          <div>
            <p className="text-sm font-display font-semibold text-foreground mb-2">Uso do produto</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
              <Stat icon={FileText} label="Posts criados" value={data.posts} />
              <Stat icon={CheckCircle2} label="Posts publicados" value={data.published_posts} />
              <Stat icon={Lightbulb} label="Ideias" value={data.ideas} />
              <Stat icon={CalendarRange} label="Cronogramas" value={data.cronogramas} />
              <Stat icon={Handshake} label="Collabs" value={data.collabs} />
              <Stat icon={ListTodo} label="Tarefas" value={data.tasks} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

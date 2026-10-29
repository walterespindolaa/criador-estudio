import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PAINEL DOS ROBÔS (Walter, 29/10/2026; mockup aprovado)

   Admin → Contas → Robôs. Por robô: se o agendamento disparou (cron) E se a
   função respondeu certo (cron_runs, gravado pela própria função). O cron
   "succeeded" sozinho engana: só quer dizer que o pedido saiu.
   Começa com Tendências e Avisos de stories; outros entram na lista da RPC
   admin_robos (migration 20261029000003_painel_robos).
   ═══════════════════════════════════════════════════════════════════════════ */

type Robo = {
  chave: string; nome: string; frequencia: string; jobname: string; agenda: string | null; ativo: boolean | null;
  ultima_execucao: string | null; ultimo_status: string | null; historico: string[] | null;
  falhas_recentes: number; execs_recentes: number;
  resultado_em: string | null; resultado_ok: boolean | null; resultado_detalhe: string | null;
};

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

const hora = (iso: string | null) => iso
  ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  : "nunca";

/* Próxima execução de um cron de 5 campos (UTC), mostrada no horário de Brasília.
   Cobre o que o projeto usa: número, lista (1,4), intervalo (1-5), passo (*\/15) e *. */
function campoBate(campo: string, v: number): boolean {
  return campo.split(",").some((parte) => {
    const [faixa, passoTxt] = parte.split("/");
    const passo = passoTxt ? Number(passoTxt) : 1;
    let ini = 0, fim = 59;
    if (faixa !== "*") {
      const [a, b] = faixa.split("-").map(Number);
      ini = a; fim = b ?? (passoTxt ? 59 : a);
    }
    return v >= ini && v <= fim && (v - ini) % passo === 0;
  });
}
function proxima(agenda: string | null): Date | null {
  const f = (agenda ?? "").trim().split(/\s+/);
  if (f.length !== 5) return null;
  const [mi, h, dia, mes, sem] = f;
  const t = new Date(); t.setUTCSeconds(0, 0); t.setUTCMinutes(t.getUTCMinutes() + 1);
  for (let i = 0; i < 60 * 24 * 9; i++) {
    if (campoBate(mi, t.getUTCMinutes()) && campoBate(h, t.getUTCHours()) && campoBate(dia, t.getUTCDate())
      && campoBate(mes, t.getUTCMonth() + 1) && campoBate(sem, t.getUTCDay())) return t;
    t.setUTCMinutes(t.getUTCMinutes() + 1);
  }
  return null;
}

function estado(r: Robo): "ok" | "erro" | "atencao" {
  if (r.ativo === false) return "atencao";
  if (r.ultimo_status && r.ultimo_status !== "succeeded") return "erro";
  if (r.resultado_ok === false) return "erro";
  if (r.resultado_em == null) return "atencao";
  return "ok";
}

export function AdminRobos() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-robos"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await sbRpc("admin_robos");
      if (error) throw error;
      return (data ?? []) as Robo[];
    },
  });
  const rodar = useMutation({
    mutationFn: async (jobname: string) => {
      const { error } = await sbRpc("admin_rodar_robo", { _jobname: jobname });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Disparado. O resultado aparece aqui em alguns segundos.");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["admin-robos"] }), 8000);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui rodar."),
  });

  if (q.isLoading) return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (q.error) return <p className="py-6 text-sm text-destructive">Não carregou o painel: {(q.error as Error).message}. A função admin_robos já está no banco?</p>;

  const robos = q.data ?? [];
  const falhas = robos.reduce((s, r) => s + (r.falhas_recentes ?? 0) + (r.resultado_ok === false ? 1 : 0), 0);
  const proximas = robos.map((r) => proxima(r.agenda)).filter((d): d is Date => !!d).sort((a, b) => +a - +b);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[150px] rounded-2xl bg-muted/50 px-4 py-3">
          <b className="block font-display text-2xl leading-none">{robos.length}</b>
          <span className="text-xs text-muted-foreground font-body">robôs acompanhados</span>
        </div>
        <div className="flex-1 min-w-[150px] rounded-2xl bg-muted/50 px-4 py-3">
          <b className={cn("block font-display text-2xl leading-none", falhas ? "text-red-600" : "text-emerald-700")}>{falhas}</b>
          <span className="text-xs text-muted-foreground font-body">falhas nos últimos 3 dias</span>
        </div>
        <div className="flex-1 min-w-[150px] rounded-2xl bg-muted/50 px-4 py-3">
          <b className="block font-display text-2xl leading-none">{proximas[0] ? hora(proximas[0].toISOString()).split(" ")[1] ?? hora(proximas[0].toISOString()) : "?"}</b>
          <span className="text-xs text-muted-foreground font-body">próxima execução</span>
        </div>
        <Button variant="outline" size="sm" className="self-center rounded-full" onClick={() => q.refetch()}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", q.isFetching && "animate-spin")} /> Atualizar
        </Button>
      </div>

      <div className="space-y-3">
        {robos.map((r) => {
          const st = estado(r);
          const prox = proxima(r.agenda);
          const hist = [...(r.historico ?? [])].reverse();
          return (
            <div key={r.chave} className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] gap-3.5 items-center rounded-2xl border border-border bg-card px-4 py-3.5">
              <span className={cn("w-10 h-10 rounded-xl grid place-items-center text-white font-display font-extrabold text-lg",
                st === "ok" ? "bg-emerald-600" : st === "erro" ? "bg-red-600" : "bg-amber-500")}>
                {st === "ok" ? "✓" : "!"}
              </span>
              <div className="min-w-0">
                <b className="block font-display text-[17px] leading-tight">{r.nome}</b>
                <span className="block text-[13px] text-muted-foreground font-body">{r.frequencia}{r.ativo === false ? " · agendamento DESLIGADO" : ""}</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className={cn("text-[11px] font-bold rounded-full px-2 py-0.5",
                    r.ultimo_status === "succeeded" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>
                    Disparou {hora(r.ultima_execucao)}{r.ultimo_status && r.ultimo_status !== "succeeded" ? ` · ${r.ultimo_status}` : ""}
                  </span>
                  <span className={cn("text-[11px] font-bold rounded-full px-2 py-0.5",
                    r.resultado_ok == null ? "bg-amber-100 text-amber-800" : r.resultado_ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}
                    title={r.resultado_detalhe ?? undefined}>
                    {r.resultado_ok == null ? "Função ainda não registrou resultado" : r.resultado_ok ? `Função respondeu ok ${hora(r.resultado_em)}` : `Função falhou ${hora(r.resultado_em)}`}
                  </span>
                  <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-muted">{r.execs_recentes} execuções, {r.falhas_recentes} falhas (3 dias)</span>
                  {prox && <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-muted">próxima: {hora(prox.toISOString())}</span>}
                </div>
                {hist.length > 0 && (
                  <div className="flex gap-[3px] mt-2" aria-label="Últimas execuções">
                    {hist.map((s, i) => <span key={i} className={cn("w-2.5 h-[18px] rounded-[3px]", s === "succeeded" ? "bg-emerald-200" : "bg-red-300")} />)}
                  </div>
                )}
                {r.resultado_ok === false && r.resultado_detalhe && (
                  <p className="mt-1.5 text-[12px] font-body text-red-800 break-words">{r.resultado_detalhe}</p>
                )}
              </div>
              <div className="col-span-2 sm:col-span-1 flex gap-1.5">
                <Button size="sm" className="rounded-full" disabled={rodar.isPending} onClick={() => rodar.mutate(r.jobname)}>
                  {rodar.isPending && rodar.variables === r.jobname ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />} Rodar agora
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, TrendingUp, Users, Clock, Ticket, ChevronDown, ArrowUpRight, AlertCircle, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { brlReais } from "@/lib/money";

type PlanRow = { label: string; count: number; mrr: number; emails: string[] };
type Billing = {
  active: number; trialing: number; converted?: number; pastDue?: number; canceled30?: number;
  mrr: number; currency: string; planBreakdown?: PlanRow[];
};

const brl = brlReais;

function Card({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 h-full">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-body">{label}</span>
      </div>
      <p className="text-2xl font-display font-extrabold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground font-body mt-0.5">{sub}</p>}
    </div>
  );
}

export function AdminFaturamento() {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const { data, isLoading, error, refetch, isFetching } = useQuery<Billing>({
    queryKey: ["admin-billing"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-billing");
      if (error) throw error;
      const err = (data as { error?: string })?.error;
      if (err) throw new Error(err);
      return data as Billing;
    },
    staleTime: 5 * 60 * 1000,
  });

  const ticket = data && data.active > 0 ? data.mrr / data.active : 0;
  const rows = data?.planBreakdown ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground font-body">Dados ao vivo do Stripe, só assinaturas pagas.</p>
        <button onClick={() => refetch()} className="shrink-0 inline-flex items-center gap-1.5 text-xs font-body font-medium rounded-lg border border-border px-3 py-1.5 hover:bg-muted transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground font-body py-6 text-center">Carregando do Stripe…</p>
      ) : error ? (
        /* O ERRO EXATO, EM VEZ DE TRÊS PALPITES (Walter, 22/09/2026). A caixa
           dizia sempre a mesma frase genérica, e cada causa tem uma saída
           diferente: chave ausente é um segredo pra cadastrar, forbidden é
           permissão, e "Failed to send" é a function que não foi pro ar. */
        <div className="rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-5 font-body">
          <p className="text-sm text-destructive font-semibold">Não consegui ler o Stripe.</p>
          {(() => {
            const m = String((error as Error)?.message ?? "");
            if (/stripe_not_configured/i.test(m)) {
              return (
                <p className="text-[13px] text-destructive/90 mt-1.5 leading-relaxed">
                  A function está no ar, mas sem a chave: cadastre <code className="font-mono">STRIPE_SECRET_KEY</code> nos
                  segredos do Supabase e clique em Atualizar. (Não precisa me mandar a chave, cola direto lá.)
                </p>
              );
            }
            if (/forbidden|unauthorized/i.test(m)) {
              return <p className="text-[13px] text-destructive/90 mt-1.5">A function respondeu que esta conta não é admin.</p>;
            }
            if (/failed to send|fetch|not found|404/i.test(m)) {
              return (
                <p className="text-[13px] text-destructive/90 mt-1.5 leading-relaxed">
                  A function <code className="font-mono">admin-billing</code> não respondeu. Provavelmente ainda não foi
                  deployada neste projeto.
                </p>
              );
            }
            return <p className="text-[13px] text-destructive/90 mt-1.5">Resposta: <code className="font-mono">{m || "erro sem mensagem"}</code></p>;
          })()}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-fr">
            <Card icon={TrendingUp} label="MRR (receita recorrente)" value={brl(data!.mrr)} sub={`em ${data!.currency}`} />
            <Card icon={Users} label="Assinaturas ativas" value={String(data!.active)} sub="pagando no Stripe" />
            <Card icon={Clock} label="Em teste (trial)" value={String(data!.trialing)} />
            <Card icon={Ticket} label="Ticket médio" value={brl(ticket)} sub="MRR ÷ ativas" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
            <Card icon={ArrowUpRight} label="Converteram de trial" value={String(data!.converted ?? 0)} sub="trials que viraram pagantes" />
            <Card icon={AlertCircle} label="Inadimplência" value={String(data!.pastDue ?? 0)} sub="pagamentos em atraso" />
            <Card icon={UserMinus} label="Churn (30 dias)" value={String(data!.canceled30 ?? 0)} sub="cancelamentos no mês" />
          </div>

          <div>
            <p className="text-sm font-display font-semibold text-foreground mb-2">Assinaturas por produto</p>
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground font-body">
                Nenhuma assinatura paga ativa no Stripe ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => {
                  const isOpen = openRow === r.label;
                  return (
                    <div key={r.label} className="rounded-xl border border-border bg-card overflow-hidden">
                      <button onClick={() => setOpenRow(isOpen ? null : r.label)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors">
                        <span className="font-display font-bold text-foreground flex-1">{r.label}</span>
                        <span className="text-sm text-muted-foreground">{r.count} assinante(s)</span>
                        <span className="text-sm font-semibold text-foreground">{brl(r.mrr)}/mês</span>
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3 pt-1 border-t border-border">
                          {r.emails.length === 0 ? (
                            <p className="text-xs text-muted-foreground font-body py-1">Sem e-mails disponíveis.</p>
                          ) : (
                            <ul className="text-xs text-muted-foreground font-body space-y-0.5 max-h-48 overflow-y-auto">
                              {r.emails.map((e, i) => <li key={i} className="truncate">{e}</li>)}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

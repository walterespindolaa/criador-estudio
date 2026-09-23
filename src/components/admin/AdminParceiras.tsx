import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Check, Copy, Loader2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PARCEIRAS NO ADMIN: FICHA E FECHAMENTO  (Walter, 22/09/2026)

   O que existia: a ficha da parceira tinha dois cards riscados com o texto
   "em breve (Fase B)" no lugar de Comissões e Clientes. Ou seja, você abria a
   parceira e não via quanto ela gerou. E pagar era achar a linha na lista de
   indicações e marcar uma por uma.

   Duas telas resolvem isso:

   RESUMO  · quanto está a pagar no total, quanto já saiu, e a lista de
             parceiras ordenada por quem tem mais a receber. Clientes trazidos,
             receita gerada e comissão devida, por parceira.

   FECHAR O MÊS · o trabalho de verdade. Agrupa os lançamentos por parceira e
             competência, mostra a chave PIX com botão de copiar, e um clique
             marca tudo daquele mês como pago com o comprovante junto. O
             pagamento continua sendo por fora (não existe API de PIX aqui); o
             que a tela faz é não deixar você perder a conta.
   ═══════════════════════════════════════════════════════════════════════════ */

type Parceira = {
  id: string; nome: string | null; cupom: string | null; pix: string | null; status: string;
  clientes: number; clientes_ativos: number;
  receita_gerada: number; a_pagar: number; ja_pago: number;
};
type Fechar = {
  partner_id: string; nome: string | null; pix: string | null;
  competencia: string; lancamentos: number; total: number; pago: boolean;
};
type Resumo = {
  totais: { a_pagar: number; pago_total: number; mes_atual: number };
  parceiras: Parceira[];
  fechamento: Fechar[];
};

const brl = (c: number | null | undefined) =>
  ((c ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mesBR = (iso: string) => {
  try {
    const [a, m] = iso.split("-");
    return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  } catch { return iso; }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

function Copiavel({ valor, rotulo }: { valor: string | null; rotulo: string }) {
  const [ok, setOk] = useState(false);
  if (!valor) return <span className="text-[11px] font-body text-muted-foreground">sem {rotulo}</span>;
  return (
    <button type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(valor); setOk(true); toast.success(`${rotulo} copiado`); setTimeout(() => setOk(false), 1500); }
        catch { toast.error("Não consegui copiar."); }
      }}
      className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-primary transition-colors max-w-[190px]">
      <span className="truncate">{valor}</span>
      {ok ? <Check className="h-3 w-3 shrink-0 text-green-600" /> : <Copy className="h-3 w-3 shrink-0" />}
    </button>
  );
}

export function AdminParceiras() {
  const { profile } = useProfile();
  const qc = useQueryClient();
  const [vista, setVista] = useState<"resumo" | "fechar">("resumo");
  const [pagando, setPagando] = useState<Fechar | null>(null);
  const [comprovante, setComprovante] = useState("");

  const { data, isLoading, error } = useQuery<Resumo | null>({
    queryKey: ["admin-parceiras"],
    enabled: profile?.role === "admin",
    queryFn: async () => {
      const { data, error } = await rpc("admin_parceiras_resumo");
      if (error) {
        if (/does not exist|schema cache|could not find/i.test(error.message)) return null;
        throw error;
      }
      return (data ?? null) as Resumo | null;
    },
  });

  const pagar = useMutation({
    mutationFn: async (f: Fechar) => {
      const { data, error } = await rpc("admin_pagar_competencia", {
        _partner_id: f.partner_id, _competencia: f.competencia,
        _note: comprovante.trim() || null,
      });
      if (error) throw new Error(error.message);
      const r = data as { ok?: boolean; motivo?: string; total_cents?: number };
      if (!r?.ok) throw new Error(r?.motivo ?? "não deu pra fechar");
      return r;
    },
    onSuccess: (r) => {
      toast.success(`Fechado: ${brl(r.total_cents)} marcados como pagos.`);
      setPagando(null); setComprovante("");
      qc.invalidateQueries({ queryKey: ["admin-parceiras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;

  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="text-sm font-display font-bold text-foreground">
          {error ? "Não consegui ler as parceiras" : "As funções ainda não estão no banco"}
        </p>
        <p className="text-[12.5px] font-body text-muted-foreground mt-1">
          Rode a migration <code className="font-mono">20260922000002_comissao_recorrente.sql</code> e recarregue.
          Se já rodou, pode ser cache de schema: <code className="font-mono">notify pgrst, &apos;reload schema&apos;;</code>
        </p>
      </div>
    );
  }

  const { totais, parceiras, fechamento } = data;
  const aFechar = fechamento.filter((f) => !f.pago);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-body font-bold text-amber-700 flex items-center gap-1">
            <Wallet className="h-3 w-3" /> A pagar
          </p>
          <p className="text-[24px] leading-none font-display font-extrabold text-foreground mt-1.5">{brl(totais.a_pagar)}</p>
          <p className="text-[11px] font-body text-muted-foreground mt-1">{brl(totais.mes_atual)} é deste mês</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-body font-bold text-muted-foreground flex items-center gap-1">
            <Check className="h-3 w-3" /> Já pago
          </p>
          <p className="text-[24px] leading-none font-display font-extrabold text-foreground mt-1.5">{brl(totais.pago_total)}</p>
          <p className="text-[11px] font-body text-muted-foreground mt-1">desde o começo</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-body font-bold text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> Parceiras ativas
          </p>
          <p className="text-[24px] leading-none font-display font-extrabold text-foreground mt-1.5">{parceiras.length}</p>
          <p className="text-[11px] font-body text-muted-foreground mt-1">
            {parceiras.reduce((a, p) => a + p.clientes_ativos, 0)} clientes ativos vieram delas
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {([["resumo", "Por parceira"], ["fechar", `Fechar o mês${aFechar.length ? ` (${aFechar.length})` : ""}`]] as const).map(([v, r]) => (
          <button key={v} type="button" onClick={() => setVista(v)}
            className={cn("rounded-xl px-3 py-1.5 text-[12.5px] font-body font-semibold transition-colors",
              vista === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
            {r}
          </button>
        ))}
      </div>

      {vista === "resumo" ? (
        parceiras.length === 0 ? (
          <p className="text-sm font-body text-muted-foreground py-6 text-center">Nenhuma parceira aprovada ainda.</p>
        ) : (
          <div className="rounded-2xl border border-border overflow-hidden">
            {parceiras.map((p, i) => (
              <div key={p.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", i > 0 && "border-t border-border")}>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-body font-semibold text-foreground truncate">{p.nome || "Sem nome"}</p>
                  <p className="text-[11px] font-body text-muted-foreground">
                    <span className="font-mono">{p.cupom ?? "sem cupom"}</span>
                    {" · "}{p.clientes_ativos} de {p.clientes} clientes ativos
                    {" · "}gerou {brl(p.receita_gerada)}
                  </p>
                </div>
                <div className="shrink-0"><Copiavel valor={p.pix} rotulo="PIX" /></div>
                <div className="text-right shrink-0 min-w-[96px]">
                  <p className={cn("text-[14px] font-display font-bold", p.a_pagar > 0 ? "text-amber-700" : "text-muted-foreground")}>
                    {brl(p.a_pagar)}
                  </p>
                  <p className="text-[10.5px] font-body text-muted-foreground">
                    {p.ja_pago > 0 ? `${brl(p.ja_pago)} já pago` : "a pagar"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : aFechar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-display font-bold text-foreground">Nada em aberto</p>
          <p className="text-[12.5px] font-body text-muted-foreground mt-1">
            Toda comissão liberada já foi paga. Quando entrar fatura nova, ela aparece aqui.
          </p>
        </div>
      ) : (
        <>
          <p className="text-[12px] font-body text-muted-foreground">
            Cada linha é um mês de uma parceira. Copie o PIX, pague por fora e confirme aqui pra fechar a competência.
          </p>
          <div className="rounded-2xl border border-border overflow-hidden">
            {aFechar.map((f, i) => (
              <div key={`${f.partner_id}-${f.competencia}`} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", i > 0 && "border-t border-border")}>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-body font-semibold text-foreground truncate">{f.nome || "Sem nome"}</p>
                  <p className="text-[11px] font-body text-muted-foreground capitalize">
                    {mesBR(f.competencia)} · {f.lancamentos} {f.lancamentos === 1 ? "lançamento" : "lançamentos"}
                  </p>
                </div>
                <div className="shrink-0"><Copiavel valor={f.pix} rotulo="PIX" /></div>
                <p className="text-[15px] font-display font-extrabold text-foreground shrink-0">{brl(f.total)}</p>
                <Button size="sm" className="rounded-xl shrink-0" onClick={() => { setPagando(f); setComprovante(""); }}>
                  Marcar como pago
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!pagando} onOpenChange={(o) => { if (!o && !pagar.isPending) setPagando(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Fechar a competência</DialogTitle>
            <DialogDescription>
              {pagando && (
                <>Isso marca <b>{brl(pagando.total)}</b> de {pagando.nome} como pago, referente a {mesBR(pagando.competencia)}. Confirme só depois que o PIX sair.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs font-body font-bold text-foreground">ID da transação (opcional)</label>
            <Input value={comprovante} onChange={(e) => setComprovante(e.target.value)}
              placeholder="Cole o identificador do PIX" className="mt-1.5 rounded-xl" />
            <p className="text-[11px] font-body text-muted-foreground mt-1.5">
              Fica guardado no fechamento. Se a parceira perguntar daqui a três meses, a resposta está aqui.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagando(null)} disabled={pagar.isPending}>Cancelar</Button>
            <Button onClick={() => pagando && pagar.mutate(pagando)} disabled={pagar.isPending}>
              {pagar.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

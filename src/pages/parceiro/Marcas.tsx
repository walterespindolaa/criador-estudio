import { Loader2, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ROTULO_PAPEL, useMeusCaches, useMinhasAgencias } from "@/hooks/useParceiro";

/* Quem acoplou o parceiro, com a carga e as entregas de cada relação. É o "com
   quem eu trabalho" que faltava na área dele, e a tela que vira a base do
   relatório de cobrança da fase 3. */

const brl = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Marcas() {
  const { data: agencias = [], isLoading } = useMinhasAgencias();
  const { data: caches = [] } = useMeusCaches();
  const cacheDe = (id: string) => caches.find((c) => c.manager_id === id);
  const totalPendente = caches.reduce((s, c) => s + Number(c.pendente ?? 0), 0);
  const totalPago = caches.reduce((s, c) => s + Number(c.pago ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* O título mora na faixa hero do ParceiroLayout. */}

      {/* MEUS CACHÊS (fase 3): o que cada agência deve e já pagou. Nasce do
          cachê combinado no card, lançado no Caixa dela quando você entrega.
          Só aparece quando existe algum lançamento. */}
      {caches.length > 0 && (
        <Card className="rounded-2xl border-border p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-8 w-8 rounded-xl bg-green-100 text-green-700 grid place-items-center"><Wallet className="h-4 w-4" /></span>
            <div>
              <p className="font-display font-bold text-[15px] text-foreground leading-tight">Meus cachês</p>
              <p className="text-[11.5px] font-body text-muted-foreground">Cada entrega com cachê combinado entra aqui. Quem marca como pago é a agência, no Caixa dela.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
              <p className="font-display font-extrabold text-lg leading-none text-amber-800">{brl(totalPendente)}</p>
              <p className="text-[11px] font-body font-semibold text-amber-900/70 mt-1">a receber</p>
            </div>
            <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2.5">
              <p className="font-display font-extrabold text-lg leading-none text-green-700">{brl(totalPago)}</p>
              <p className="text-[11px] font-body font-semibold text-green-800/70 mt-1">já recebido</p>
            </div>
          </div>
          <ul className="divide-y divide-border/70">
            {caches.map((c) => (
              <li key={c.manager_id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block text-[13px] font-body font-semibold text-foreground truncate">{c.agencia}</span>
                  <span className="block text-[11px] font-body text-muted-foreground">
                    {c.pendente_qtd > 0 ? `${c.pendente_qtd} entrega${c.pendente_qtd > 1 ? "s" : ""} em aberto` : "Tudo pago"}
                    {c.ultimo_pago ? ` · último pagamento ${c.ultimo_pago.slice(8, 10)}/${c.ultimo_pago.slice(5, 7)}` : ""}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[13px] font-display font-extrabold text-amber-800">{brl(Number(c.pendente))}</span>
                  <span className="block text-[10.5px] font-body text-green-700">{brl(Number(c.pago))} pago</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : agencias.length === 0 ? (
        <Card className="p-10 rounded-2xl border-dashed text-center">
          <p className="text-sm font-body text-muted-foreground max-w-md mx-auto">
            Nenhuma agência te acoplou ainda. Quando uma social mídia te convidar como parceiro,
            ela aparece aqui e os posts dela caem em Minhas demandas.
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {agencias.map((a) => {
            const cx = cacheDe(a.agencia_id);
            return (
              <Card key={a.agencia_id} className="rounded-2xl border-border p-5">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-white grid place-items-center font-display font-bold shrink-0">
                    {a.agencia_nome.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display font-bold text-[15px] text-foreground truncate">{a.agencia_nome}</span>
                    <span className="block text-xs font-body text-muted-foreground">
                      Você atende como {ROTULO_PAPEL[a.meu_papel] ?? a.meu_papel}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mt-4">
                  <div className="rounded-xl bg-muted/50 border border-border px-3 py-2.5">
                    <p className="font-display font-extrabold text-lg leading-none">{a.abertos}</p>
                    <p className="text-[11px] font-body font-semibold text-muted-foreground mt-1">na sua mão agora</p>
                  </div>
                  <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2.5">
                    <p className="font-display font-extrabold text-lg leading-none text-green-700">{a.entregues_30d}</p>
                    <p className="text-[11px] font-body font-semibold text-green-800/70 mt-1">entregues em 30 dias</p>
                  </div>
                </div>
                {cx && Number(cx.pendente) > 0 && (
                  <p className="mt-2.5 text-[11.5px] font-body text-amber-800">
                    {brl(Number(cx.pendente))} a receber desta agência.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

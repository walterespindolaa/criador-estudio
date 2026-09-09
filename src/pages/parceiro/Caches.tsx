import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Loader2, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CardAbertoDialog } from "@/pages/app/MinhasDemandas";
import { useMeusCaches, useMeusCachesDetalhe } from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   MEUS CACHÊS

   Era um card espremido no topo de "Marcas que atendo", com dois totais e uma
   linha por agência. Dinheiro dividindo tela com identidade de marca é confusão
   (Walter, 09/09/2026): viraram duas páginas.

   E o total sozinho não responde a pergunta que ele faz na hora de cobrar, que
   é "de QUAIS entregas vem esse valor". Agora a página abre no que ele tem a
   receber, quebra por agência, e lista peça a peça, com o card abrindo dali.
   ═══════════════════════════════════════════════════════════════════════════ */

const brl = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ehPago = (s: string) => /pago|recebid|quitad/i.test(s);

export default function Caches() {
  const { data: porAgencia = [] } = useMeusCaches();
  const { data: linhas = [], isLoading } = useMeusCachesDetalhe();
  const [abrirCard, setAbrirCard] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"aberto" | "pago" | "tudo">("aberto");

  const totalPendente = porAgencia.reduce((s, c) => s + Number(c.pendente ?? 0), 0);
  const totalPago = porAgencia.reduce((s, c) => s + Number(c.pago ?? 0), 0);

  const visiveis = useMemo(() => linhas.filter((l) => {
    if (filtro === "tudo") return true;
    return filtro === "pago" ? ehPago(l.status) : !ehPago(l.status);
  }), [linhas, filtro]);

  // Agrupa por agência: é assim que a cobrança acontece, uma conversa por agência.
  const grupos = useMemo(() => {
    const m = new Map<string, { nome: string; itens: typeof visiveis; soma: number }>();
    for (const l of visiveis) {
      const g = m.get(l.agencia_id) ?? { nome: l.agencia_nome, itens: [], soma: 0 };
      g.itens.push(l);
      if (!ehPago(l.status)) g.soma += Number(l.valor ?? 0);
      m.set(l.agencia_id, g);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].soma - a[1].soma);
  }, [visiveis]);

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* O QUE EU TENHO A RECEBER: o número que abre a página. */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="rounded-2xl border-amber-200 bg-amber-50/60 p-5">
          <p className="text-[11px] font-body font-bold uppercase tracking-wider text-amber-900/70 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> A receber
          </p>
          <p className="font-display font-extrabold text-3xl text-amber-900 mt-1 leading-none">{brl(totalPendente)}</p>
          <p className="text-[11.5px] font-body text-amber-900/70 mt-1.5">
            Entra no Caixa da agência quando você entrega. Quem marca como pago é ela.
          </p>
        </Card>
        <Card className="rounded-2xl border-green-200 bg-green-50/60 p-5">
          <p className="text-[11px] font-body font-bold uppercase tracking-wider text-green-800/70 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Já recebido
          </p>
          <p className="font-display font-extrabold text-3xl text-green-800 mt-1 leading-none">{brl(totalPago)}</p>
          <p className="text-[11.5px] font-body text-green-800/70 mt-1.5">
            Somando tudo que as agências já quitaram com você.
          </p>
        </Card>
      </div>

      {/* AS ENTREGAS, uma a uma. É o que ele manda quando cobra. */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="font-display font-bold text-[15px] text-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> De onde vem esse valor
          </h2>
          <div className="flex gap-1 rounded-xl bg-muted p-0.5">
            {([["aberto", "Em aberto"], ["pago", "Pagos"], ["tudo", "Tudo"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFiltro(k)}
                className={cn("px-3 py-1 rounded-lg text-[12px] font-body font-semibold transition-colors",
                  filtro === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-14"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : visiveis.length === 0 ? (
          <Card className="p-10 rounded-2xl border-dashed text-center">
            <p className="text-sm font-body text-muted-foreground max-w-md mx-auto">
              {filtro === "pago"
                ? "Nenhum cachê pago ainda."
                : "Nenhum cachê em aberto. Quando você entregar uma peça com valor combinado, ela aparece aqui."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {grupos.map(([agenciaId, g]) => (
              <Card key={agenciaId} className="rounded-2xl border-border overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
                  <p className="font-display font-bold text-[14px] text-foreground truncate">{g.nome}</p>
                  {g.soma > 0 && (
                    <span className="text-[12.5px] font-display font-extrabold text-amber-800 shrink-0">{brl(g.soma)} a receber</span>
                  )}
                </div>
                <ul className="divide-y divide-border/70">
                  {g.itens.map((l) => {
                    const pago = ehPago(l.status);
                    return (
                      <li key={l.id}>
                        <button type="button" disabled={!l.post_id}
                          onClick={() => l.post_id && setAbrirCard(l.post_id)}
                          className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                            l.post_id ? "hover:bg-muted/40" : "cursor-default")}>
                          <span className="w-8 h-8 rounded-lg grid place-items-center text-white text-[11px] font-display font-bold shrink-0 overflow-hidden"
                            style={{ background: l.cliente_cor || "#7C90F0" }}>
                            {l.cliente_logo
                              ? <img src={l.cliente_logo} alt="" className="w-full h-full object-cover" loading="lazy" />
                              : (l.cliente_nome || "C").charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-body font-semibold text-foreground truncate">
                              {l.post_titulo || l.descricao || "Entrega"}
                            </span>
                            <span className="block text-[11px] font-body text-muted-foreground truncate">
                              {l.cliente_nome ?? "Sem cliente"} · {dataBR(l.data)}
                            </span>
                          </span>
                          <span className="text-right shrink-0">
                            <span className={cn("block text-[13px] font-display font-extrabold", pago ? "text-green-700" : "text-amber-800")}>
                              {brl(Number(l.valor))}
                            </span>
                            <span className={cn("block text-[10px] font-body font-bold", pago ? "text-green-700" : "text-amber-700")}>
                              {pago ? "pago" : "em aberto"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      <p className="text-[11.5px] font-body text-muted-foreground px-0.5">
        O valor de cada peça é combinado pela agência quando ela te manda o trabalho. Divergiu, é com ela.
      </p>

      <CardAbertoDialog postId={abrirCard} aoFechar={() => setAbrirCard(null)} />
    </div>
  );
}

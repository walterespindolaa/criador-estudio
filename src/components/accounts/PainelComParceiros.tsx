import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, CheckCircle2, Clock, Loader2, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { hojeBR } from "@/lib/date-br";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ROTULO_PAPEL, useMeusParceiros, usePecasComParceiros, useResolverPrazoSugerido,
  type PecaExterna,
} from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   COM PARCEIROS: a produção externa vista pela social mídia

   A pergunta que esta tela responde é a que a Gabriela faz todo dia sem ter
   onde olhar: "o que está com o designer, em que etapa, e quanto tempo falta
   pro prazo de cada peça?". No Trello ela abriria o board do freelancer e
   caçaria coluna por coluna; aqui a resposta vem pronta, com o que exige
   ação DELA em cima (entregas pra revisar e prazos pra responder).

   Semáforo: verde no prazo · âmbar vence em até 48h · vermelho estourado.
   ═══════════════════════════════════════════════════════════════════════════ */

const FORMATO: Record<string, string> = {
  reels: "Reels", carrossel: "Carrossel", foto: "Estático", story: "Story",
  video: "Vídeo", shorts: "Shorts", live: "Live",
};

const dataBR = (iso: string | null) => {
  if (!iso) return null;
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}` : null;
};

/** Quantos dias entre hoje e o prazo (negativo = estourou). */
function diasAte(prazo: string, hoje: string): number {
  const [a1, m1, d1] = hoje.split("-").map(Number);
  const [a2, m2, d2] = prazo.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

function ContagemPrazo({ prazo, hoje }: { prazo: string | null; hoje: string }) {
  if (!prazo) return <span className="text-[11px] font-body text-muted-foreground">prazo a combinar</span>;
  const d = diasAte(prazo, hoje);
  const rotulo = d < 0 ? `atrasou ${-d} dia${d === -1 ? "" : "s"}`
    : d === 0 ? "vence hoje"
    : d === 1 ? "vence amanhã"
    : `vence em ${d} dias`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full",
      d < 0 ? "bg-red-600 text-white" : d <= 2 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700")}>
      <Clock className="h-3 w-3" /> {dataBR(prazo)} · {rotulo}
    </span>
  );
}

const ETAPA: Record<string, { txt: string; cls: string }> = {
  aguardando: { txt: "Novo", cls: "bg-orange-100 text-orange-700" },
  em_producao: { txt: "Fazendo", cls: "bg-blue-100 text-blue-700" },
  ajuste: { txt: "Em ajuste", cls: "bg-violet-100 text-violet-700" },
  entregue: { txt: "Entregue", cls: "bg-green-100 text-green-700" },
};

export function PainelComParceiros({ clientes }: {
  /** id do external_client → nome, vindo de quem monta a tela. */
  clientes: Record<string, string>;
}) {
  const navigate = useNavigate();
  const { data: parceiros = [] } = useMeusParceiros();
  const { data: pecas = [], isLoading } = usePecasComParceiros(parceiros.length > 0);
  const resolver = useResolverPrazoSugerido();
  const hoje = hojeBR();

  const nomeParceiro = useMemo(() => {
    const m = new Map<string, { nome: string; role: string }>();
    for (const p of parceiros) m.set(p.member_id, { nome: p.nome, role: p.role });
    return m;
  }, [parceiros]);

  // O que exige ação DELA, sempre em cima.
  const praRevisar = pecas.filter((p) => p.producao_status === "entregue" && p.approval_status === "em_producao");
  const prazosPraResponder = pecas.filter((p) => p.prazo_status === "negociando" && p.prazo_sugerido);
  const abertas = pecas.filter((p) => p.producao_status !== "entregue");

  const porParceiro = useMemo(() => {
    const mapa = new Map<string, PecaExterna[]>();
    for (const p of abertas) mapa.set(p.assignee_id, [...(mapa.get(p.assignee_id) ?? []), p]);
    return [...mapa.entries()];
  }, [abertas]);

  if (parceiros.length === 0) return null;

  const abrirPeca = (p: PecaExterna) => {
    // O card do post vive no workspace do cliente; sem cliente, fica aqui.
    if (p.external_client_id) navigate(`/socialmidia/clientes/${p.external_client_id}/posts`);
  };

  const linhaPeca = (p: PecaExterna, extra?: React.ReactNode) => (
    <button key={p.id} type="button" onClick={() => abrirPeca(p)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors">
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold text-[14px] leading-tight truncate">{p.title || "Sem título"}</span>
        <span className="flex items-center gap-2 mt-1 flex-wrap">
          {p.external_client_id && clientes[p.external_client_id] && (
            <span className="text-[11.5px] font-body font-semibold text-foreground/85">{clientes[p.external_client_id]}</span>
          )}
          {p.format && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{FORMATO[p.format] ?? p.format}</span>}
          {p.producao_status && ETAPA[p.producao_status] && (
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", ETAPA[p.producao_status].cls)}>
              {ETAPA[p.producao_status].txt}
            </span>
          )}
          {p.prazo_status === "proposto" && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">aguardando aceite do prazo</span>
          )}
        </span>
      </span>
      <span className="shrink-0 flex items-center gap-2">
        {extra ?? <ContagemPrazo prazo={p.prazo_producao} hoje={hoje} />}
      </span>
    </button>
  );

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="grid place-items-center py-14"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* ── 1. PRA VOCÊ REVISAR: entregas esperando ela levar pro cliente ── */}
          {praRevisar.length > 0 && (
            <section>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-green-800 mb-2 px-0.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Pra você revisar ({praRevisar.length})
              </p>
              <Card className="rounded-2xl border-green-200 bg-green-50/40 overflow-hidden divide-y divide-green-100">
                {praRevisar.map((p) => linhaPeca(p,
                  <span className="text-[11px] font-bold text-green-700 bg-green-100 rounded-full px-2.5 py-1">
                    entregue {p.updated_at ? new Date(p.updated_at).toLocaleDateString("pt-BR") : ""}
                  </span>))}
              </Card>
            </section>
          )}

          {/* ── 2. PRAZOS PRA RESPONDER: contrapropostas do parceiro ── */}
          {prazosPraResponder.length > 0 && (
            <section>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-800 mb-2 px-0.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Prazos pra responder ({prazosPraResponder.length})
              </p>
              <Card className="rounded-2xl border-blue-200 bg-blue-50/40 overflow-hidden divide-y divide-blue-100">
                {prazosPraResponder.map((p) => linhaPeca(p,
                  <span className="flex items-center gap-2">
                    <span className="text-[11.5px] font-body text-blue-900">
                      {nomeParceiro.get(p.assignee_id)?.nome.split(" ")[0] ?? "Parceiro"} sugeriu <b>{dataBR(p.prazo_sugerido)}</b>
                    </span>
                    <Button size="sm" className="rounded-xl h-8" disabled={resolver.isPending}
                      onClick={(e) => { e.stopPropagation(); resolver.mutate({ postId: p.id, dataAceita: p.prazo_sugerido! }); }}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Aceitar
                    </Button>
                  </span>))}
              </Card>
              <p className="text-[11px] font-body text-muted-foreground mt-1.5 px-0.5">
                Prefere outra data? Abra o post e reenvie pelo "Enviar para" com o novo prazo.
              </p>
            </section>
          )}

          {/* ── 3. NA MÃO DE CADA PARCEIRO ── */}
          {porParceiro.length === 0 && praRevisar.length === 0 ? (
            <Card className="p-10 rounded-2xl border-dashed text-center">
              <Users className="h-7 w-7 mx-auto text-muted-foreground mb-2.5" />
              <p className="text-sm font-body font-medium text-foreground">Nada com parceiros agora</p>
              <p className="text-xs text-muted-foreground font-body mt-1 max-w-md mx-auto">
                Delegue um post pelo botão <b>Enviar para</b> dentro do editor: ele aparece aqui com a
                etapa e a contagem do prazo, e o parceiro recebe o aviso na hora.
              </p>
            </Card>
          ) : (
            porParceiro.map(([assigneeId, lista]) => {
              const quem = nomeParceiro.get(assigneeId);
              const atrasadas = lista.filter((p) => p.prazo_producao && diasAte(p.prazo_producao, hoje) < 0).length;
              return (
                <section key={assigneeId}>
                  <p className="flex items-center gap-2 mb-2 px-0.5">
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-violet-700 text-white grid place-items-center text-[10px] font-bold">
                      {(quem?.nome ?? "P").charAt(0).toUpperCase()}
                    </span>
                    <span className="font-display font-bold text-[14px]">{quem?.nome ?? "Parceiro"}</span>
                    <span className="text-[11px] font-body text-muted-foreground">
                      {quem ? (ROTULO_PAPEL[quem.role] ?? quem.role) : ""} · {lista.length} na mão
                    </span>
                    {atrasadas > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
                        {atrasadas} atrasada{atrasadas === 1 ? "" : "s"}
                      </span>
                    )}
                  </p>
                  <Card className="rounded-2xl border-border overflow-hidden divide-y divide-border">
                    {lista.map((p) => linhaPeca(p))}
                  </Card>
                </section>
              );
            })
          )}

          <p className="text-[11px] font-body text-muted-foreground px-0.5 flex items-center gap-1.5">
            <Send className="h-3 w-3" /> O parceiro vê a mesma peça na área dele, com specs, marca e
            material. A conversa fica no card, dos dois lados.
          </p>
        </>
      )}
    </div>
  );
}

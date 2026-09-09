import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { motion } from "framer-motion";
import {
  Briefcase, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  Copy as CopyIcon, ExternalLink, Folder, ImagePlus, Loader2, MessageCircle, Palette,
  Pencil, Play, Plus, RotateCcw, Send, Sparkles, X,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hojeBR } from "@/lib/date-br";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FichaDaMarca } from "@/pages/parceiro/Marcas";
import {
  ROTULO_PAPEL, useAcoesDoParceiro, useCardDoParceiro, useEntreguesDoParceiro,
  useFilaDoParceiro, useMinhasAgencias, useMinhasMarcas,
  type CardDaFila, type EntregueDoParceiro, type MarcaDoParceiro,
} from "@/hooks/useParceiro";
import {
  useEtapasPessoais, useMetasDosCards, useSalvarCardMeta,
  type CardMeta, type EtapaPessoal,
} from "@/hooks/useParceiroPessoal";

/* ═══════════════════════════════════════════════════════════════════════════
   MINHAS DEMANDAS, a tela do parceiro (designer, editor, copy)

   É a fila por prazo do protótipo: tudo que foi delegado pra pessoa, de TODAS
   as agências que a acoplaram, agrupado por dia de entrega e com o card
   abrindo por cima. Quadro, semana e mês vêm na fase 2; esta é a visão que
   responde "o que eu faço hoje?".
   ═══════════════════════════════════════════════════════════════════════════ */

const FORMATO: Record<string, string> = {
  reels: "Reels", carrossel: "Carrossel", foto: "Estático", story: "Story",
  video: "Vídeo", shorts: "Shorts", live: "Live",
};

const dataBR = (iso: string | null) => {
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return null;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};

/** Agrupa por dia de entrega, com os sem prazo no fim ("Combinar prazo"). */
function porDia(cards: CardDaFila[]) {
  const mapa = new Map<string, CardDaFila[]>();
  for (const c of cards) {
    const chave = c.prazo_producao ?? "sem-prazo";
    mapa.set(chave, [...(mapa.get(chave) ?? []), c]);
  }
  return [...mapa.entries()].sort(([a], [b]) => {
    if (a === "sem-prazo") return 1;
    if (b === "sem-prazo") return -1;
    return a.localeCompare(b);
  });
}

function rotuloDoDia(chave: string, hoje: string): { titulo: string; tom: "hoje" | "perto" | "folga" | "atrasado" } {
  if (chave === "sem-prazo") return { titulo: "Sem prazo combinado", tom: "folga" };
  const [a, m, d] = chave.split("-").map(Number);
  const rot = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
  if (chave < hoje) return { titulo: `Atrasado · ${rot}`, tom: "atrasado" };
  if (chave === hoje) return { titulo: "Hoje", tom: "hoje" };
  const amanha = new Date(a, m - 1, d - 1).toISOString().slice(0, 10) === hoje;
  return amanha ? { titulo: "Amanhã", tom: "perto" } : { titulo: rot, tom: "folga" };
}

const EstadoPill = ({ s }: { s: CardDaFila["producao_status"] }) => (
  <span className={cn("shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full",
    s === "aguardando" && "bg-foreground text-background",
    s === "em_producao" && "bg-blue-100 text-blue-700",
    s === "ajuste" && "bg-violet-100 text-violet-700",
    s === "entregue" && "bg-green-100 text-green-700")}>
    {s === "aguardando" ? "Novo" : s === "em_producao" ? "Fazendo" : s === "ajuste" ? "Ajuste" : "Entregue"}
  </span>
);

export default function MinhasDemandas() {
  const { data: todas = [], isLoading } = useFilaDoParceiro();
  const { data: agencias = [] } = useMinhasAgencias();
  const [aberto, setAberto] = useState<string | null>(null);
  const [visao, setVisao] = useState<"prazo" | "quadro" | "cliente" | "semana" | "mes">("prazo");
  /* FILTRAR POR AGÊNCIA (Walter, 09/09/2026): "não consigo clicar na social
     mídia e ver os clientes dela". As agências já estavam desenhadas no topo,
     mas eram enfeite. Agora cada uma é um botão que recorta a tela inteira
     naquela agência e joga na visão por cliente, que é o quadro dela. */
  const [soAgencia, setSoAgencia] = useState<string | null>(null);
  const fila = useMemo(
    () => (soAgencia ? todas.filter((c) => c.agencia_id === soAgencia) : todas),
    [todas, soAgencia]);
  /* Quem se cadastrou como parceiro por conta própria ainda não tem agência
     nenhuma, e sem papel o quadro nascia sem etapas. O papel do perfil serve
     de base até a primeira agência acoplar (Walter, 09/09/2026). */
  const { profile } = useProfile();
  const papelDoPerfil = (profile as { parceiro_role?: string | null } | null)?.parceiro_role ?? null;
  const hoje = hojeBR();
  const grupos = useMemo(() => porDia(fila), [fila]);
  const venceHoje = fila.filter((c) => c.prazo_producao === hoje).length;
  const fazendo = fila.filter((c) => c.producao_status === "em_producao").length;
  const emAjuste = fila.filter((c) => c.producao_status === "ajuste").length;
  const entregues30 = agencias
    .filter((a) => !soAgencia || a.agencia_id === soAgencia)
    .reduce((t, a) => t + a.entregues_30d, 0);

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* O título mora na faixa do topo do ManagerLayout; aqui começa direto
            no resumo, como os módulos da social mídia fazem. */}
        {/* O RESUMO DO DIA: os quatro números que respondem "como estou?". O
            último (entregues em 30 dias) é a semente da cobrança por entrega. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { v: venceHoje, l: "Vence hoje", cor: "bg-red-500" },
            { v: fazendo, l: "Fazendo agora", cor: "bg-blue-500" },
            { v: emAjuste, l: "Voltou pra ajuste", cor: "bg-violet-500" },
            { v: entregues30, l: "Entregues em 30 dias", cor: "bg-green-600" },
          ].map((k) => (
            <Card key={k.l} className="rounded-2xl border-border p-3.5 flex items-center gap-3">
              <span className={cn("w-2 h-9 rounded-full shrink-0", k.cor)} />
              <span>
                <span className="block font-display font-extrabold text-xl leading-none">{k.v}</span>
                <span className="block text-[11px] font-body font-semibold text-muted-foreground mt-1">{k.l}</span>
              </span>
            </Card>
          ))}
        </div>

        {/* QUEM ME ACOPLOU: as agências, com a carga em cada uma. É o "não
            mostra quem tá vinculado a ele" resolvido, e a base da conversa de
            cobrança no fim do mês. */}
        {agencias.length > 0 && (
          <div className="mb-5">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
              Trabalho com {agencias.length === 1 ? "esta agência" : `${agencias.length} agências`}
            </p>
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {agencias.map((a) => {
                const ativa = soAgencia === a.agencia_id;
                return (
                  <button key={a.agencia_id} type="button"
                    onClick={() => { setSoAgencia(ativa ? null : a.agencia_id); if (!ativa) setVisao("cliente"); }}
                    className={cn("rounded-2xl border bg-card px-3.5 py-2.5 flex items-center gap-3 shrink-0 text-left transition-all",
                      ativa ? "border-primary ring-2 ring-primary/25 shadow-sm" : "border-border hover:border-primary/40")}>
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-white grid place-items-center text-xs font-bold shrink-0">
                      {a.agencia_nome.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-body font-bold text-foreground truncate max-w-[160px]">{a.agencia_nome}</span>
                      <span className="block text-[11px] font-body text-muted-foreground">
                        {ROTULO_PAPEL[a.meu_papel] ?? a.meu_papel} · {a.abertos} na mão · {a.entregues_30d} entregues/30d
                      </span>
                    </span>
                    <span className={cn("text-[10px] font-body font-bold shrink-0 ml-1",
                      ativa ? "text-primary" : "text-muted-foreground/70")}>
                      {ativa ? "vendo só esta" : "ver clientes"}
                    </span>
                  </button>
                );
              })}
            </div>
            {soAgencia && (
              <button type="button" onClick={() => setSoAgencia(null)}
                className="mt-2 text-[11.5px] font-body font-bold text-primary hover:underline px-0.5">
                mostrar todas as agências de novo
              </button>
            )}
          </div>
        )}

        {/* O SELETOR DE VISÃO: as quatro do mockup aprovado. Pílulas no accent,
            como as abas do resto do app. */}
        <div className="inline-flex gap-1 rounded-full border border-border bg-card p-1 mb-4 flex-wrap">
          {([["prazo", "Por prazo"], ["quadro", "Quadro"], ["cliente", "Por cliente"], ["semana", "Semana"], ["mes", "Mês"]] as const).map(([v, r]) => (
            <button key={v} type="button" onClick={() => setVisao(v)}
              className={cn("px-4 py-1.5 rounded-full text-[13px] font-display font-semibold transition-colors",
                visao === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {r}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : todas.length === 0 ? (
          <ComeceAqui />
        ) : visao === "semana" ? (
          <SemanaDoParceiro fila={fila} hoje={hoje} aoAbrir={setAberto} />
        ) : visao === "quadro" ? (
          <QuadroDoParceiro fila={fila} hoje={hoje} aoAbrir={setAberto} papel={agencias[0]?.meu_papel ?? papelDoPerfil} />
        ) : visao === "cliente" ? (
          <PorClienteDoParceiro fila={fila} hoje={hoje} aoAbrir={setAberto} />
        ) : visao === "mes" ? (
          <MesDoParceiro fila={fila} hoje={hoje} aoAbrir={setAberto} />
        ) : (
          grupos.map(([chave, cards]) => {
            const r = rotuloDoDia(chave, hoje);
            return (
              <section key={chave} className="mb-5">
                <div className="flex items-center gap-2.5 mb-2 px-0.5">
                  <h2 className="font-display font-bold text-[15px] text-foreground">{r.titulo}</h2>
                  <span className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full",
                    r.tom === "hoje" && "bg-red-100 text-red-700",
                    r.tom === "atrasado" && "bg-red-600 text-white",
                    r.tom === "perto" && "bg-amber-100 text-amber-700",
                    r.tom === "folga" && "bg-green-100 text-green-700")}>
                    {cards.length} entrega{cards.length === 1 ? "" : "s"}
                  </span>
                </div>
                <Card className="rounded-2xl border-border overflow-hidden divide-y divide-border">
                  {cards.map((c) => (
                    <button key={c.post_id} onClick={() => setAberto(c.post_id)}
                      className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors">
                      <span className="w-11 h-11 rounded-xl grid place-items-center text-white font-display font-bold shrink-0 overflow-hidden"
                        style={{ background: c.cliente_cor || "#7C90F0" }}>
                        {c.cliente_logo
                          ? <img src={c.cliente_logo} alt="" className="w-full h-full object-cover" />
                          : (c.cliente_nome || "C").charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display font-bold text-[14.5px] text-foreground leading-tight truncate">{c.titulo || "Sem título"}</span>
                        <span className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs font-body font-semibold text-foreground/85 truncate">{c.cliente_nome}</span>
                          <span className="text-[11px] font-body text-muted-foreground">via {c.agencia_nome}</span>
                          {c.formato && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{FORMATO[c.formato] ?? c.formato}</span>}
                          {c.publica_em && <span className="text-[11px] font-body text-muted-foreground">publica {dataBR(c.publica_em)}</span>}
                          {c.cache != null && c.cache > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                              R$ {c.cache.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          )}
                          {c.prazo_status === "proposto" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">prazo pra confirmar</span>
                          )}
                          {c.prazo_status === "negociando" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">prazo em negociação</span>
                          )}
                        </span>
                      </span>
                      <EstadoPill s={c.producao_status} />
                    </button>
                  ))}
                </Card>
              </section>
            );
          })
        )}

      </motion.div>

      <CardAbertoDialog postId={aberto} aoFechar={() => setAberto(null)} />
    </div>
  );
}

/* ── A SEMANA ─────────────────────────────────────────────────────────────
   Mesmo desenho da agenda da social mídia: sete colunas, hoje com anel, cada
   entrega colorida pelo estado. Feita no cliente em cima da mesma fila, sem
   consulta nova. */
function SemanaDoParceiro({ fila, hoje, aoAbrir }: {
  fila: CardDaFila[]; hoje: string; aoAbrir: (id: string) => void;
}) {
  const [h1, h2, h3] = hoje.split("-").map(Number);
  const base = new Date(h1, h2 - 1, h3);
  // Semana começando na segunda, como a agenda.
  const seg = new Date(base); seg.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg); d.setDate(seg.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, dia: d.getDate(), rotulo: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][i] };
  });
  const semPrazo = fila.filter((c) => !c.prazo_producao);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
        {dias.map((d) => {
          const doDia = fila.filter((c) => c.prazo_producao === d.iso);
          return (
            <div key={d.iso} className={cn("rounded-2xl border bg-card p-2.5 min-h-[150px]",
              d.iso === hoje ? "border-violet-400 ring-1 ring-violet-300" : "border-border")}>
              <p className="flex items-baseline gap-1.5 mb-2 px-0.5">
                <span className="text-[9.5px] font-bold uppercase text-muted-foreground">{d.rotulo}</span>
                <span className={cn("font-display font-extrabold text-[15px]", d.iso === hoje && "text-violet-600")}>{d.dia}</span>
                {doDia.length > 0 && <span className="ml-auto text-[9.5px] font-bold text-muted-foreground bg-muted rounded-full px-1.5">{doDia.length}</span>}
              </p>
              {doDia.length === 0 ? (
                <p className="text-[10.5px] font-body text-muted-foreground/50 text-center pt-6">livre</p>
              ) : doDia.map((c) => (
                <button key={c.post_id} onClick={() => aoAbrir(c.post_id)}
                  className={cn("w-full text-left rounded-lg px-2 py-1.5 mb-1.5 border-l-[3px] text-[11px] leading-tight transition-transform hover:translate-x-0.5",
                    c.producao_status === "ajuste" ? "bg-violet-50 border-violet-500"
                    : c.producao_status === "em_producao" ? "bg-blue-50 border-blue-500"
                    : "bg-orange-50 border-orange-500")}>
                  <span className="block font-bold truncate">{c.titulo || "Sem título"}</span>
                  <span className="block text-[9.5px] text-muted-foreground truncate mt-0.5">{c.cliente_nome}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {semPrazo.length > 0 && (
        <p className="text-[11.5px] font-body text-muted-foreground mt-3 px-0.5">
          {semPrazo.length} card{semPrazo.length === 1 ? "" : "s"} sem prazo combinado (aparecem na visão Por prazo).
        </p>
      )}
    </div>
  );
}

/* ── COMECE POR AQUI ──────────────────────────────────────────────────────
   O vazio de antes era um card seco. Pra quem acabou de ser acoplado, esta é
   a primeira tela da vida dele no Cria: precisa dizer o que vai acontecer, em
   que ordem, e o que resolve. Cada passo responde uma dor clássica do
   freelancer de agência: briefing espalhado no WhatsApp, prazo de boca,
   ajuste sem registro e cobrança de fim de mês sem prova. */
function ComeceAqui() {
  const PASSOS = [
    {
      Icone: Briefcase, cor: "bg-orange-100 text-orange-600", titulo: "1 · O card chega pronto",
      texto: "A social mídia delega e o post cai aqui com roteiro, legenda aprovada, cores da marca, hashtags e a pasta de material. Nada de caçar briefing em três conversas de WhatsApp.",
    },
    {
      Icone: Clock, cor: "bg-blue-100 text-blue-600", titulo: "2 · Prazo combinado, visível",
      texto: "Cada card mostra a data de entrega combinada, e as visões Por prazo, Quadro, Semana e Mês organizam a sua semana. Marque \"Estou fazendo\" e todo mundo sabe que está na sua mão.",
    },
    {
      Icone: MessageCircle, cor: "bg-violet-100 text-violet-600", titulo: "3 · Conversa dentro do card",
      texto: "Dúvida, versão e ajuste ficam registrados no próprio card, com a voz de cada um etiquetada (você, social mídia, cliente). O ajuste volta marcado, não por áudio perdido.",
    },
    {
      Icone: CheckCircle2, cor: "bg-green-100 text-green-700", titulo: "4 · Entrega vira histórico",
      texto: "Ao marcar entregue, a social mídia revisa e leva pro cliente. A tela Entregues soma tudo por agência: no fim do mês, a sua cobrança sai com número, não com memória.",
    },
  ];
  return (
    <div>
      <Card className="rounded-2xl border-border p-5 mb-4 bg-gradient-to-br from-orange-50/60 to-transparent">
        <p className="font-display font-extrabold text-[17px]">Nenhuma demanda aberta por enquanto</p>
        <p className="text-[13px] font-body text-muted-foreground mt-1 max-w-xl leading-relaxed">
          Quando uma social mídia delegar um post pra você, ele aparece aqui e o aviso chega no seu
          celular na hora. Enquanto isso, é assim que o trabalho flui:
        </p>
      </Card>
      <div className="grid sm:grid-cols-2 gap-3">
        {PASSOS.map((p) => (
          <Card key={p.titulo} className="rounded-2xl border-border p-4">
            <span className={cn("w-9 h-9 rounded-xl grid place-items-center mb-2.5", p.cor)}>
              <p.Icone className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <p className="font-display font-bold text-[14px]">{p.titulo}</p>
            <p className="text-[12.5px] font-body text-muted-foreground mt-1 leading-relaxed">{p.texto}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ── O QUADRO DE DUAS CAMADAS (mockup aprovado) ───────────────────────────
   As 4 colunas de fora são o CONTRATO com as agências (Novo, Fazendo,
   Ajuste, Entregue): não se renomeiam, porque são a língua que a social
   mídia lê. DENTRO do Fazendo ficam as etapas PESSOAIS do parceiro
   (Referências, Rascunho, Arte final... editáveis), e ele arrasta os cards
   entre elas. A agência continua vendo só "Fazendo": o processo é dele. */
function QuadroDoParceiro({ fila, hoje, aoAbrir, papel }: {
  fila: CardDaFila[]; hoje: string; aoAbrir: (id: string) => void; papel: string | null;
}) {
  const { etapas, criar, renomear, excluir } = useEtapasPessoais(papel);
  const { data: metas = {} } = useMetasDosCards();
  const salvarMeta = useSalvarCardMeta();
  const [editandoEtapas, setEditandoEtapas] = useState(false);
  // Mesma chave da tela Entregues: compartilha o cache, sem consulta dobrada.
  const { data: entregues = [] } = useEntreguesDoParceiro();

  const novos = fila.filter((c) => c.producao_status === "aguardando");
  const fazendo = fila.filter((c) => c.producao_status === "em_producao");
  const ajustes = fila.filter((c) => c.producao_status === "ajuste");

  // Card sem etapa (ou com etapa apagada) mora na PRIMEIRA etapa dele.
  const etapaDoCard = (postId: string): string => {
    const e = metas[postId]?.etapa_id;
    if (e && etapas.some((x) => x.id === e)) return e;
    return etapas[0]?.id ?? "sem-etapa";
  };

  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    salvarMeta.mutate({ postId: r.draggableId, etapaId: r.destination.droppableId });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[230px_1fr_230px_230px] gap-3 items-start">
      {/* ── NOVO (contrato) ── */}
      <div className="rounded-2xl border border-border p-2.5 bg-orange-50/70">
        <p className="flex items-center gap-2 px-1 pb-2">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="font-display font-bold text-[13px]">Novo</span>
          <span className="ml-auto text-[10px] font-bold text-muted-foreground bg-card rounded-full px-2 py-0.5 border border-border">{novos.length}</span>
        </p>
        {novos.length === 0
          ? <p className="text-[11px] font-body text-muted-foreground/60 text-center py-6">vazio</p>
          : novos.map((c) => <CartaoQuadro key={c.post_id} c={c} hoje={hoje} meta={metas[c.post_id]} onOpen={() => aoAbrir(c.post_id)} />)}
      </div>

      {/* ── FAZENDO com as etapas PESSOAIS ── */}
      <div className="rounded-2xl border border-border p-2.5 bg-blue-50/70">
        <p className="flex items-center gap-2 px-1 pb-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="font-display font-bold text-[13px]">Fazendo</span>
          <span className="text-[8.5px] font-bold uppercase tracking-wide bg-blue-600 text-white rounded-full px-2 py-0.5">suas etapas</span>
          <button type="button" onClick={() => setEditandoEtapas(true)}
            className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-800 hover:text-blue-900">
            <Pencil className="h-3 w-3" /> Editar etapas
          </button>
        </p>
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(etapas.length, 1)}, minmax(0, 1fr))` }}>
            {(etapas.length > 0 ? etapas : [{ id: "sem-etapa", nome: "Fazendo", ordem: 0 }]).map((et) => {
              const doLane = fazendo.filter((c) => etapaDoCard(c.post_id) === et.id);
              return (
                <Droppable key={et.id} droppableId={et.id}>
                  {(prov, snap) => (
                    <div ref={prov.innerRef} {...prov.droppableProps}
                      className={cn("rounded-xl border border-dashed border-blue-200 bg-white/60 p-1.5 min-h-[120px] transition-colors",
                        snap.isDraggingOver && "border-blue-500 bg-blue-100/50")}>
                      <p className="text-[10px] font-bold text-blue-900/80 px-1 pb-1.5 truncate">{et.nome} <span className="opacity-60">({doLane.length})</span></p>
                      {doLane.map((c, i) => (
                        <Draggable key={c.post_id} draggableId={c.post_id} index={i} disableInteractiveElementBlocking>
                          {(dp, ds) => (
                            <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps}
                              style={dp.draggableProps.style}
                              className={cn(ds.isDragging && "rotate-1")}>
                              <CartaoQuadro c={c} hoje={hoje} meta={metas[c.post_id]} onOpen={() => aoAbrir(c.post_id)} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
        <p className="text-[9.5px] font-body text-blue-900/60 px-1 pt-1.5">
          Arraste entre as SUAS etapas. A agência vê só "Fazendo": o processo é seu.
        </p>
      </div>

      {/* ── AJUSTE (contrato) ── */}
      <div className="rounded-2xl border border-border p-2.5 bg-violet-50/70">
        <p className="flex items-center gap-2 px-1 pb-2">
          <span className="w-2 h-2 rounded-full bg-violet-500" />
          <span className="font-display font-bold text-[13px]">Ajuste</span>
          <span className="ml-auto text-[10px] font-bold text-muted-foreground bg-card rounded-full px-2 py-0.5 border border-border">{ajustes.length}</span>
        </p>
        {ajustes.length === 0
          ? <p className="text-[11px] font-body text-muted-foreground/60 text-center py-6">vazio</p>
          : ajustes.map((c) => <CartaoQuadro key={c.post_id} c={c} hoje={hoje} meta={metas[c.post_id]} onOpen={() => aoAbrir(c.post_id)} />)}
      </div>

      {/* ── ENTREGUE (contrato) ── */}
      <div className="rounded-2xl border border-border bg-green-50/70 p-2.5">
        <p className="flex items-center gap-2 px-1 pb-2">
          <span className="w-2 h-2 rounded-full bg-green-600" />
          <span className="font-display font-bold text-[13px]">Entregue</span>
          <span className="ml-auto text-[10px] font-bold text-muted-foreground bg-card rounded-full px-2 py-0.5 border border-border">{entregues.length}</span>
        </p>
        {entregues.length === 0
          ? <p className="text-[11px] font-body text-muted-foreground/60 text-center py-6">vazio</p>
          : entregues.slice(0, 6).map((e) => (
            <button key={e.post_id} onClick={() => aoAbrir(e.post_id)}
              className="w-full text-left rounded-xl border border-border bg-card px-3 py-2.5 mb-2 shadow-sm hover:shadow transition-shadow">
              <span className="block font-display font-bold text-[13px] leading-tight">{e.titulo || "Sem título"}</span>
              <span className="block text-[10.5px] font-body text-muted-foreground mt-1">
                {e.cliente_nome} · ✓ {new Date(e.entregue_em).toLocaleDateString("pt-BR")}
              </span>
            </button>
          ))}
        {entregues.length > 6 && (
          <p className="text-[10.5px] font-body text-muted-foreground text-center pt-1">o resto está em Entregues</p>
        )}
      </div>

      <EditorEtapasDialog aberto={editandoEtapas} aoFechar={() => setEditandoEtapas(false)}
        etapas={etapas} criar={criar} renomear={renomear} excluir={excluir} />
    </div>
  );
}

/** O cartão do quadro/por cliente: cliente na cor da ficha, formato, prazo
 *  com semáforo e o progresso do checklist PESSOAL (só o dono vê). */
function CartaoQuadro({ c, hoje, meta, onOpen }: {
  c: CardDaFila; hoje: string; meta?: CardMeta; onOpen: () => void;
}) {
  const atrasado = c.prazo_producao && c.prazo_producao < hoje;
  const total = meta?.checklist.length ?? 0;
  const feitos = meta?.checklist.filter((i) => i.done).length ?? 0;
  /* NÃO É <button> (Walter, 09/09/2026): o @hello-pangea/dnd aborta o início
     do arraste quando o nó do Draggable é um elemento interativo, e o cartão
     inteiro era um botão. Resultado: no quadro do parceiro nada arrastava, nem
     no mouse nem no toque. Mesmo problema, mesma correção da agenda
     (AgendaCriacao.tsx). Vira div com papel de botão e teclado no braço. */
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="w-full text-left rounded-xl border border-border bg-card mb-2 shadow-sm hover:shadow transition-shadow cursor-pointer overflow-hidden">
      {/* A CAPA DA PEÇA (Walter, 09/09/2026): quando o card já tem mídia, ela
          vira a capa do cartão, como no Trello. `draggable={false}` porque
          senão o navegador arrasta a IMAGEM em vez do cartão. */}
      {c.capa && (
        <img src={c.capa} alt="" loading="lazy" draggable={false}
          className="w-full aspect-[4/5] object-cover border-b border-border" />
      )}
      <span className="block px-3 py-2.5">
      <span className="flex items-center gap-2 mb-1.5">
        <span className="w-5 h-5 rounded-md grid place-items-center text-white text-[9px] font-bold shrink-0 overflow-hidden"
          style={{ background: c.cliente_cor || "#EA4918" }}>
          {c.cliente_logo
            ? <img src={c.cliente_logo} alt="" className="w-full h-full object-cover" />
            : (c.cliente_nome || "C").charAt(0).toUpperCase()}
        </span>
        <span className="text-[10.5px] font-body font-semibold text-muted-foreground truncate">{c.cliente_nome}</span>
      </span>
      <span className="block font-display font-bold text-[13px] leading-tight">{c.titulo || "Sem título"}</span>
      <span className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {c.formato && <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{FORMATO[c.formato] ?? c.formato}</span>}
        {c.prazo_producao && (
          <span className={cn("text-[9.5px] font-bold px-1.5 py-0.5 rounded-full",
            atrasado ? "bg-red-600 text-white" : c.prazo_producao === hoje ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
            {atrasado ? "atrasado" : c.prazo_producao === hoje ? "hoje" : dataBR(c.prazo_producao)}
          </span>
        )}
        {c.prazo_status === "proposto" && <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">prazo pra confirmar</span>}
      </span>
      {total > 0 && (
        <>
          <span className="block text-[9px] font-body text-muted-foreground mt-1.5">☑ {feitos}/{total} do seu checklist</span>
          <span className="block h-1 rounded-full bg-muted overflow-hidden mt-1">
            <span className="block h-full bg-green-500" style={{ width: `${Math.round((feitos / total) * 100)}%` }} />
          </span>
        </>
      )}
      </span>
    </div>
  );
}

/** Editar as etapas pessoais: renomear inline, criar, apagar. Direcionamento
 *  padrão vem semeado pelo papel, mas o quadro é dele. */
function EditorEtapasDialog({ aberto, aoFechar, etapas, criar, renomear, excluir }: {
  aberto: boolean; aoFechar: () => void; etapas: EtapaPessoal[];
  criar: { mutate: (nome: string) => void; isPending: boolean };
  renomear: { mutate: (v: { id: string; nome: string }) => void };
  excluir: { mutate: (id: string) => void };
}) {
  const [nova, setNova] = useState("");
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogTitle className="font-display font-extrabold">Minhas etapas do Fazendo</DialogTitle>
        <p className="text-[12px] font-body text-muted-foreground -mt-1">
          O seu jeito de trabalhar, do seu jeito. As agências continuam vendo só "Fazendo".
        </p>
        <div className="space-y-2 mt-1">
          {etapas.map((et) => (
            <div key={et.id} className="flex items-center gap-2">
              <input defaultValue={et.nome}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== et.nome) renomear.mutate({ id: et.id, nome: v }); }}
                className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2 text-[13px] font-body font-semibold" />
              <button type="button" aria-label={`Excluir ${et.nome}`} onClick={() => excluir.mutate(et.id)}
                className="text-muted-foreground hover:text-destructive p-1.5"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nova etapa"
            onKeyDown={(e) => { if (e.key === "Enter" && nova.trim()) { criar.mutate(nova); setNova(""); } }}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[13px] font-body" />
          <Button size="sm" className="rounded-xl" disabled={!nova.trim() || criar.isPending}
            onClick={() => { criar.mutate(nova); setNova(""); }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── POR CLIENTE, NO ESPÍRITO DO QUADRO DA GABRIELA ───────────────────────
   Walter mandou o Trello dela: cada cliente é uma COLUNA, o primeiro cartão é
   o "Infos Clientes" fixo (material da marca, refs, regras) e os cartões
   seguintes mostram a ARTE PRONTA como capa. Bate o olho e ela sabe o que
   existe, de quem é e o que falta, sem abrir nada.

   Aqui é a mesma gramática: coluna por marca, na cor da marca, com a ficha
   fixa no topo, as peças em produção no meio e as entregues no pé, com capa
   quando a peça tem mídia. É o que faltava pro parceiro entender o sistema
   sem ninguém explicar (Walter, 09/09/2026). */
function PorClienteDoParceiro({ fila, hoje, aoAbrir }: {
  fila: CardDaFila[]; hoje: string; aoAbrir: (id: string) => void;
}) {
  const { data: metas = {} } = useMetasDosCards();
  const { data: marcas = [] } = useMinhasMarcas();
  const { data: entregues = [] } = useEntreguesDoParceiro();
  const [ficha, setFicha] = useState<MarcaDoParceiro | null>(null);

  const colunas = useMemo(() => {
    const mapa = new Map<string, { nome: string; cards: CardDaFila[]; prontas: EntregueDoParceiro[] }>();
    for (const c of fila) {
      const chave = c.external_client_id || c.cliente_nome || "sem-cliente";
      const g = mapa.get(chave) ?? { nome: c.cliente_nome || "Cliente", cards: [], prontas: [] };
      g.cards.push(c);
      mapa.set(chave, g);
    }
    /* As entregues só entram em coluna que JÁ existe: a visão é "o que está
       na minha mão agora", e o pronto é o rodapé dela, não o assunto. */
    for (const e of entregues) {
      const chave = e.external_client_id || e.cliente_nome || "sem-cliente";
      const g = mapa.get(chave);
      if (g) g.prontas.push(e);
    }
    return [...mapa.entries()].sort((a, b) => b[1].cards.length - a[1].cards.length);
  }, [fila, entregues]);

  return (
    <>
      {/* Rolagem horizontal, como quadro de verdade. No celular a coluna ocupa
          quase a tela toda e o polegar desliza de cliente em cliente. */}
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
        {colunas.map(([chave, g]) => {
          const primeiro = g.cards[0];
          const cor = primeiro?.cliente_cor || "#4B3FA8";
          const marca = marcas.find((m) => m.external_client_id === chave);
          const atrasados = g.cards.filter((c) => c.prazo_producao && c.prazo_producao < hoje).length;
          const ordenados = [...g.cards].sort((a, b) =>
            (a.prazo_producao ?? "9999").localeCompare(b.prazo_producao ?? "9999"));
          return (
            <section key={chave} className="w-[270px] sm:w-[292px] shrink-0 snap-start rounded-2xl border border-border overflow-hidden bg-card">
              {/* CABEÇALHO NA COR DA MARCA: é o que dá identidade à coluna e
                  mata o bege chapado que o Walter reclamou. */}
              <header className="px-3 py-2.5 flex items-center gap-2.5"
                style={{ background: `linear-gradient(135deg, ${cor}22, ${cor}0d)`, borderBottom: `2px solid ${cor}` }}>
                <span className="w-8 h-8 rounded-lg grid place-items-center text-white text-[11px] font-bold overflow-hidden shrink-0 border border-white/60"
                  style={{ background: cor }}>
                  {primeiro?.cliente_logo
                    ? <img src={primeiro.cliente_logo} alt="" className="w-full h-full object-cover" />
                    : g.nome.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-bold text-[13.5px] leading-tight truncate">{g.nome}</span>
                  <span className="block text-[10.5px] font-body text-muted-foreground truncate">
                    via {primeiro?.agencia_nome} · {g.cards.length} na mão
                  </span>
                </span>
                {atrasados > 0 && (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white shrink-0">
                    {atrasados} atrasado{atrasados === 1 ? "" : "s"}
                  </span>
                )}
              </header>

              <div className="p-2 space-y-2 bg-muted/25">
                {/* O CARTÃO FIXO DE INFOS DO CLIENTE. É o "Infos Clientes" que
                    ela mantém no topo de cada lista: material, refs, regras.
                    Fica sempre no mesmo lugar, em todas as colunas. */}
                {marca ? (
                  <button type="button" onClick={() => setFicha(marca)}
                    className="w-full text-left rounded-xl border-2 border-dashed px-3 py-2.5 transition-colors hover:bg-card"
                    style={{ borderColor: `${cor}66`, background: `${cor}0a` }}>
                    <span className="flex items-center gap-1.5 font-display font-bold text-[12.5px]" style={{ color: cor }}>
                      <Sparkles className="h-3.5 w-3.5" /> Infos do cliente
                    </span>
                    <span className="block text-[10.5px] font-body text-muted-foreground mt-0.5 leading-snug">
                      {[marca.links?.length ? `${marca.links.length} link${marca.links.length === 1 ? "" : "s"} de material` : null,
                        marca.referencias?.length ? `${marca.referencias.length} refs` : null,
                        marca.evitar?.trim() ? "regras do que evitar" : null,
                        marca.fontes?.trim() ? "fontes" : null]
                        .filter(Boolean).join(" · ") || "cor, tom de voz e hashtags da marca"}
                    </span>
                  </button>
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-[10.5px] font-body text-muted-foreground leading-snug">
                    A ficha desta marca aparece aqui assim que a agência preencher o brandbook dela.
                  </p>
                )}

                {ordenados.map((c) => (
                  <div key={c.post_id} className="relative">
                    <CartaoQuadro c={c} hoje={hoje} meta={metas[c.post_id]} onOpen={() => aoAbrir(c.post_id)} />
                    <span className="absolute top-2 right-2"><EstadoPill s={c.producao_status} /></span>
                  </div>
                ))}

                {/* O QUE JÁ FICOU PRONTO: é aqui que a capa da arte brilha. */}
                {g.prontas.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-green-700 px-1 pb-1.5">
                      Prontas ({g.prontas.length})
                    </p>
                    {g.prontas.slice(0, 4).map((e) => (
                      <button key={e.post_id} type="button" onClick={() => aoAbrir(e.post_id)}
                        className="w-full text-left rounded-xl border border-green-200 bg-green-50/50 overflow-hidden mb-2 hover:shadow-sm transition-shadow">
                        {e.capa && (
                          <img src={e.capa} alt="" loading="lazy"
                            className="w-full aspect-[4/5] object-cover border-b border-green-200" />
                        )}
                        <span className="block px-3 py-2">
                          <span className="block font-display font-bold text-[12.5px] leading-tight line-clamp-2">{e.titulo || "Sem título"}</span>
                          <span className="block text-[10px] font-body text-green-800/80 mt-0.5">
                            entregue em {new Date(e.entregue_em).toLocaleDateString("pt-BR")}
                          </span>
                        </span>
                      </button>
                    ))}
                    {g.prontas.length > 4 && (
                      <p className="text-[10px] font-body text-muted-foreground text-center pb-1">o resto está em Entregues</p>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-[11px] font-body text-muted-foreground px-0.5">
        Uma coluna por cliente, como no seu quadro. O cartão pontilhado do topo guarda o material
        e as regras da marca: abre uma vez e serve pra todas as peças dela.
      </p>
      <FichaDaMarca m={ficha} aoFechar={() => setFicha(null)} />
    </>
  );
}

/* ── O MÊS ────────────────────────────────────────────────────────────────
   Mesma gramática do calendário da agenda: grade de sete colunas, navegação
   por mês, hoje com anel, entrega pintada pelo estado. */
function MesDoParceiro({ fila, hoje, aoAbrir }: {
  fila: CardDaFila[]; hoje: string; aoAbrir: (id: string) => void;
}) {
  const [h1, h2] = hoje.split("-").map(Number);
  const [ref, setRef] = useState({ ano: h1, mes: h2 }); // mes 1-12
  const mudar = (delta: number) => {
    const d = new Date(ref.ano, ref.mes - 1 + delta, 1);
    setRef({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
  };
  const primeiro = new Date(ref.ano, ref.mes - 1, 1);
  const diasNoMes = new Date(ref.ano, ref.mes, 0).getDate();
  const desloc = (primeiro.getDay() + 6) % 7; // semana começa na segunda
  const celulas: (string | null)[] = [
    ...Array.from({ length: desloc }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) =>
      `${ref.ano}-${String(ref.mes).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
  ];
  const rotuloMes = primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const semPrazo = fila.filter((c) => !c.prazo_producao);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button type="button" onClick={() => mudar(-1)} className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-display font-extrabold text-[15px] capitalize min-w-[160px] text-center">{rotuloMes}</p>
        <button type="button" onClick={() => mudar(1)} className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <p key={d} className="text-[9.5px] font-bold uppercase text-muted-foreground text-center">{d}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celulas.map((iso, i) => {
          if (!iso) return <div key={`v${i}`} />;
          const doDia = fila.filter((c) => c.prazo_producao === iso);
          return (
            <div key={iso} className={cn("rounded-xl border bg-card p-1 min-h-[74px] md:min-h-[92px]",
              iso === hoje ? "border-primary ring-1 ring-primary/40" : "border-border")}>
              <p className={cn("text-[10px] font-display font-bold px-0.5", iso === hoje ? "text-primary" : "text-muted-foreground")}>
                {Number(iso.slice(8))}
              </p>
              {doDia.slice(0, 3).map((c) => (
                <button key={c.post_id} onClick={() => aoAbrir(c.post_id)} title={`${c.titulo} · ${c.cliente_nome}`}
                  className={cn("w-full text-left rounded-md px-1 py-0.5 mb-0.5 border-l-2 text-[9px] leading-tight truncate block",
                    c.producao_status === "ajuste" ? "bg-violet-50 border-violet-500"
                    : c.producao_status === "em_producao" ? "bg-blue-50 border-blue-500"
                    : "bg-orange-50 border-orange-500")}>
                  {c.titulo || c.cliente_nome || "Card"}
                </button>
              ))}
              {doDia.length > 3 && <p className="text-[8.5px] font-bold text-muted-foreground px-1">+{doDia.length - 3}</p>}
            </div>
          );
        })}
      </div>
      {semPrazo.length > 0 && (
        <p className="text-[11.5px] font-body text-muted-foreground mt-3 px-0.5">
          {semPrazo.length} card{semPrazo.length === 1 ? "" : "s"} sem prazo combinado (aparecem na visão Por prazo).
        </p>
      )}
    </div>
  );
}

/* ── O CARD ABERTO ────────────────────────────────────────────────────────── */

/* Specs por formato: a pesquisa é unânime em que a MAIOR fonte de ida e volta
   é peça sem especificação (proporção, medida, duração). Aqui o card já nasce
   com a spec do formato, sem o parceiro precisar perguntar. */
const SPEC_FORMATO: Record<string, string> = {
  reels: "9:16 · 1080x1920 · até 90s",
  carrossel: "4:5 · 1080x1350 por arte",
  foto: "4:5 · 1080x1350",
  story: "9:16 · 1080x1920",
  video: "confirmar proporção no comentário",
  shorts: "9:16 · 1080x1920 · até 60s",
  live: "16:9",
};

/* Onde a peça está DEPOIS que saiu da mão do parceiro. Ele não mexe nesse
   eixo, mas parar de ficar cego era pedido direto da pesquisa. */
const ROTULO_APROVACAO: Record<string, { txt: string; cls: string }> = {
  em_producao: { txt: "Com a social mídia", cls: "bg-slate-100 text-slate-700" },
  pendente: { txt: "Aguardando o cliente aprovar", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { txt: "Cliente pediu ajuste", cls: "bg-orange-100 text-orange-700" },
  aprovado: { txt: "Aprovado pelo cliente", cls: "bg-green-100 text-green-700" },
  postado: { txt: "Postado", cls: "bg-slate-200 text-slate-600" },
};

/* ── O CHAT DO CARD ───────────────────────────────────────────────────────
   Walter, 09/09/2026: "a conversa deveria ficar do lado direito e ser um chat
   mesmo, hoje começa na metade do popup, sem pé nem cabeça, e deveria ficar em
   branco em vez de bege".

   Três mudanças de fundo, não de enfeite:
   1. Coluna inteira, do topo ao rodapé, com fundo branco. O cabeçalho fica em
      cima, as falas rolam no meio e o campo de escrever fica colado embaixo.
   2. Balões: o que é seu vai pra direita, o que é dos outros pra esquerda. É a
      leitura que qualquer pessoa já tem no dedo, de WhatsApp.
   3. Imagem na conversa. No Trello a designer solta a arte no comentário e
      todo mundo vê ali. Aqui link de imagem vira imagem, e o clipe manda uma
      do computador (que também fica anexada ao card). */

const EH_IMAGEM = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const ACHAR_URL = /(https?:\/\/[^\s]+)/g;

/** Quebra o texto em pedaços: URL de imagem vira imagem, URL comum vira link
 *  clicável, o resto é texto. É o "Ref https://pinterest..." do quadro dela
 *  deixando de ser texto morto. */
function FalaFormatada({ texto, meu }: { texto: string; meu: boolean }) {
  const pedacos = texto.split(ACHAR_URL).filter((p) => p !== "");
  return (
    <>
      {pedacos.map((p, i) => {
        if (!/^https?:\/\//.test(p)) {
          return <span key={i} className="whitespace-pre-line">{p}</span>;
        }
        if (EH_IMAGEM.test(p)) {
          return (
            <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="block mt-1.5 first:mt-0">
              <img src={p} alt="" loading="lazy"
                className="rounded-lg border border-border max-h-56 w-auto object-contain bg-card" />
            </a>
          );
        }
        return (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer"
            className={cn("underline break-all", meu ? "text-white/90" : "text-primary")}>
            {p.replace(/^https?:\/\//, "").slice(0, 42)}{p.length > 50 ? "..." : ""}
          </a>
        );
      })}
    </>
  );
}

function ChatDoCard({ cor, mensagens, texto, setTexto, enviar, enviando, anexando, aoMandarImagem, aoLimparTexto }: {
  cor: string;
  mensagens: { id: string; texto: string; papel: string; em: string }[];
  texto: string;
  setTexto: (v: string) => void;
  enviar: () => Promise<void>;
  enviando: boolean;
  anexando: boolean;
  aoMandarImagem: (arquivo: File) => void;
  aoLimparTexto: () => void;
}) {
  const fim = useRef<HTMLDivElement | null>(null);
  const inputImagem = useRef<HTMLInputElement | null>(null);
  // Abrir a conversa já no fim: o que importa é a última fala, não a primeira.
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [mensagens.length]);

  return (
    <div className="bg-card border-t-2 lg:border-l border-border flex flex-col min-h-0 md:col-span-2 lg:col-span-1 lg:order-3 lg:h-full"
      style={{ borderTopColor: cor }}>
      <p className="shrink-0 px-4 py-3 border-b border-border text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <MessageCircle className="h-3.5 w-3.5" style={{ color: cor }} /> Conversa deste card
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 max-lg:max-h-[46vh]">
        {mensagens.length === 0 ? (
          <p className="text-xs font-body text-muted-foreground text-center py-8 px-4 leading-relaxed">
            Nada combinado por aqui ainda. O que for escrito neste chat fica no card,
            some do WhatsApp nunca mais.
          </p>
        ) : mensagens.map((cm) => {
          /* O cliente escreve com vários papéis (client, cliente,
             cliente_externo, cliente_externo_aprovacao). Todos contêm
             "client"; sem isso a fala dele saía rotulada como social mídia
             (auditoria 07/09). */
          const meu = cm.papel === "parceiro";
          const doCliente = /client/.test(cm.papel);
          return (
            <div key={cm.id} className={cn("flex flex-col", meu ? "items-end" : "items-start")}>
              <span className={cn("text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full mb-1",
                meu ? "bg-violet-100 text-violet-700"
                : doCliente ? "bg-green-100 text-green-700" : "bg-pink-100 text-pink-700")}>
                {meu ? "você" : doCliente ? "cliente" : "social mídia"}
              </span>
              <div className={cn("max-w-[88%] rounded-2xl px-3 py-2 text-[13px] font-body leading-relaxed break-words",
                meu ? "bg-violet-600 text-white rounded-br-sm"
                : "bg-muted/70 border border-border rounded-bl-sm")}>
                <FalaFormatada texto={cm.texto} meu={meu} />
              </div>
              <span className="text-[9.5px] font-body text-muted-foreground mt-0.5 px-1">
                {new Date(cm.em).toLocaleDateString("pt-BR")} às {new Date(cm.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
        <div ref={fim} />
      </div>

      <div className="shrink-0 border-t border-border p-2.5">
        <div className="flex items-end gap-1.5">
          <input ref={inputImagem} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { aoMandarImagem(f); aoLimparTexto(); }
              e.target.value = "";
            }} />
          <button type="button" onClick={() => inputImagem.current?.click()} disabled={anexando}
            title="Mandar uma imagem (fica anexada ao card também)"
            className="shrink-0 grid h-[42px] w-[38px] place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50">
            {anexando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </button>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1}
            onKeyDown={(e) => {
              // Enter manda, Shift+Enter pula linha: gramática de chat.
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); }
            }}
            placeholder="Escrever... a social mídia recebe na hora"
            className="rounded-xl resize-none min-h-[42px] max-h-28 text-sm" />
          <Button size="sm" onClick={() => void enviar()} disabled={!texto.trim() || enviando} className="rounded-xl h-[42px] shrink-0">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CardAbertoDialog({ postId, aoFechar }: { postId: string | null; aoFechar: () => void }) {
  const navigate = useNavigate();
  const { data: card, isLoading } = useCardDoParceiro(postId);
  const { marcar, comentar, responderPrazo, anexar } = useAcoesDoParceiro(postId);
  const [texto, setTexto] = useState("");
  // Entregar em dois tempos: o clique abre o campo do link da versão final.
  const [entregando, setEntregando] = useState(false);
  const [linkEntrega, setLinkEntrega] = useState("");
  // Entrega com ARQUIVO (fase 3): sobe direto pro card, sem passar por link.
  const inputArquivo = useRef<HTMLInputElement | null>(null);
  // Checklist pessoal (camada privada do card).
  const { data: metasCards = {} } = useMetasDosCards();
  const salvarMeta = useSalvarCardMeta();
  const minhaMeta = postId ? metasCards[postId] : undefined;
  const [novoItem, setNovoItem] = useState("");
  // Negociação de prazo: sugerir abre data + motivo.
  const [sugerindo, setSugerindo] = useState(false);
  const [dataSugerida, setDataSugerida] = useState("");
  const [motivoPrazo, setMotivoPrazo] = useState("");

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    await comentar.mutateAsync(t);
    setTexto("");
  };

  // Clipboard falha em iframe/HTTP/permissão negada: sem o try o erro
  // estourava mudo e o botão parecia quebrado.
  const copiar = async (txt: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      toast.success(msg);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie manualmente.");
    }
  };
  const copiarLegenda = () => { if (card?.legenda) void copiar(card.legenda, "Legenda copiada."); };

  return (
    <Dialog open={!!postId} onOpenChange={(v) => !v && aoFechar()}>
      {/* ALTURA FIXA, NÃO MÁXIMA (Walter, 09/09/2026): com `max-h` o diálogo
          encolhia até o tamanho do briefing e a conversa nascia no meio da
          tela, "sem pé nem cabeça". Agora ele ocupa uma altura definida e cada
          coluna rola por dentro: o chat começa no topo e termina no rodapé,
          como chat de verdade. */}
      <DialogContent className="max-w-6xl w-[calc(100vw-1.5rem)] p-0 gap-0 rounded-2xl overflow-hidden h-[90vh] flex flex-col [&>button:last-child]:hidden">
        {isLoading || !card ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* A CAPA DA MARCA. Era uma faixa chapada na cor do cliente, e
                ficava apagada (Walter, 09/09/2026). Agora ela usa o LOGO do
                cliente de duas formas: borrado e ampliado no fundo, dando
                textura e profundidade na cor da própria marca, e nítido na
                frente junto do nome. Sem logo, continua o degradê da cor, mas
                com o nome escrito: faixa vazia não diz de quem é a peça. */}
            <div className="relative h-28 shrink-0 overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${card.marca.cor || "#4B3FA8"}, ${card.marca.cor || "#4B3FA8"}aa)` }}>
              {card.marca.logo && (
                <img src={card.marca.logo} alt="" aria-hidden draggable={false}
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                  style={{ transform: "scale(1.8)", filter: "blur(26px) saturate(1.4)" }} />
              )}
              <span aria-hidden className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/15" />
              <span aria-hidden className="absolute -left-8 -bottom-14 h-32 w-32 rounded-full bg-black/10" />
              {/* O X PADRÃO DO DIALOG some (é cinza-claro e sumia em cima da
                  capa colorida). Este é redondo, com fundo próprio, e continua
                  legível em qualquer cor de marca (Walter, 09/09/2026). */}
              <button type="button" onClick={aoFechar} aria-label="Fechar"
                className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-black/45">
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <div className="relative h-full flex items-center gap-3 px-5">
                {card.marca.logo && (
                  <span className="w-12 h-12 rounded-full bg-white/95 border-2 border-white/70 overflow-hidden grid place-items-center shrink-0 shadow-lg">
                    <img src={card.marca.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block font-display font-extrabold text-white text-lg leading-tight truncate drop-shadow">
                    {card.marca.nome || "Cliente"}
                  </span>
                  {card.marca.handle && (
                    <span className="block text-[12px] font-body text-white/80 truncate">@{card.marca.handle.replace(/^@/, "")}</span>
                  )}
                </span>
              </div>
            </div>
            {/* TRÊS COLUNAS NO DESKTOP (Walter, 09/09/2026): briefing | conversa |
                ações, no espírito do Trello. A conversa estava embaixo do
                briefing, então quem estava lendo o roteiro não via o que tinha
                sido combinado sem rolar. Na ordem do HTML a barra de ações vem
                antes da conversa, porque no tablet (2 colunas) a conversa vira
                uma faixa cheia embaixo; no desktop o `order` recoloca ela no
                meio. */}
            <div className="flex-1 min-h-0 grid md:grid-cols-[minmax(0,1fr)_262px] lg:grid-cols-[minmax(0,1fr)_262px_336px] overflow-y-auto lg:overflow-hidden">
              {/* A cor da marca vira um fio no topo de cada coluna: o card
                  inteiro era bege e as três colunas se confundiam. */}
              <div className="p-5 lg:order-1 border-t-2 lg:overflow-y-auto" style={{ borderTopColor: card.marca.cor || "#4B3FA8" }}>
                <DialogTitle className="font-display text-xl font-extrabold leading-tight">{card.titulo || "Sem título"}</DialogTitle>
                <p className="text-xs font-body text-muted-foreground mt-1.5">
                  <b className="text-foreground">{card.marca.nome || "Cliente"}</b> · delegado por {card.agencia}
                  {card.publica_em && <> · publica em {dataBR(card.publica_em)}</>}
                </p>

                {/* ESPECIFICAÇÕES: a maior fonte de ida e volta na pesquisa é
                    peça sem spec (proporção, medida, nº de artes). Aqui elas já
                    vêm no card, sem o parceiro precisar perguntar. */}
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  {card.formato && (
                    <span className="text-[10.5px] font-bold px-2 py-1 rounded-full bg-foreground text-background">
                      {FORMATO[card.formato] ?? card.formato}
                    </span>
                  )}
                  {card.formato && SPEC_FORMATO[card.formato] && (
                    <span className="text-[10.5px] font-bold px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      {SPEC_FORMATO[card.formato]}
                    </span>
                  )}
                  {card.formato === "carrossel" && Array.isArray(card.blocos) && (card.blocos as unknown[]).length > 0 && (
                    <span className="text-[10.5px] font-bold px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      {(card.blocos as unknown[]).length} arte{(card.blocos as unknown[]).length === 1 ? "" : "s"}
                    </span>
                  )}
                  {card.plataforma && (
                    <span className="text-[10.5px] font-bold px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize">
                      {card.plataforma}
                    </span>
                  )}
                  {/* ETIQUETAS e LINHA EDITORIAL: o RPC já mandava, a tela
                      jogava fora. É o que diz ao designer em que gaveta da
                      estratégia a peça entra (Walter, 09/09/2026). */}
                  {(card.etiquetas ?? []).map((et) => (
                    <span key={et} className="text-[10.5px] font-bold px-2 py-1 rounded-full border border-border text-muted-foreground">
                      {et}
                    </span>
                  ))}
                  {/* Depois que saiu da mão dele, onde a peça está. Fim da
                      cegueira pós-entrega. */}
                  {card.producao_status === "entregue" && card.aprovacao && ROTULO_APROVACAO[card.aprovacao] && (
                    <span className={cn("text-[10.5px] font-bold px-2 py-1 rounded-full", ROTULO_APROVACAO[card.aprovacao].cls)}>
                      {ROTULO_APROVACAO[card.aprovacao].txt}
                    </span>
                  )}
                </div>

                {/* O QUE JÁ ESTÁ ANEXADO NA PEÇA (Walter, 09/09/2026). No
                    Trello a arte fica no card e vira capa dele. Aqui o arquivo
                    ia pro banco e sumia da vista: o parceiro subia e não tinha
                    como conferir se mandou a versão certa. */}
                {(() => {
                  const midias = (card.midias ?? []).filter((m) => m.url || m.thumb);
                  if (midias.length === 0) return null;
                  return (
                    <div className="mt-4">
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Arquivos desta peça ({midias.length})
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {midias.map((m, i) => {
                          const src = m.thumb || m.url || "";
                          const ehImagem = /^image\//.test(m.tipo ?? "") || EH_IMAGEM.test(src);
                          return (
                            <a key={`${src}-${i}`} href={m.url || src} target="_blank" rel="noopener noreferrer"
                              title={m.nome ?? undefined}
                              className="block aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:border-primary/50 transition-colors">
                              {ehImagem
                                ? <img src={src} alt={m.nome ?? ""} loading="lazy" className="w-full h-full object-cover" />
                                : <span className="w-full h-full grid place-items-center px-1 text-[9px] font-body font-bold text-muted-foreground text-center leading-tight">
                                    {m.nome?.slice(0, 22) || "arquivo"}
                                  </span>}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {card.gancho?.trim() && (
                  <div className="mt-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Gancho</p>
                    <p className="text-sm font-body bg-card border border-border border-l-[3px] rounded-xl px-3 py-2.5"
                      style={{ borderLeftColor: card.marca.cor || "#4B3FA8" }}>{card.gancho}</p>
                  </div>
                )}

                {card.roteiro?.trim() && (
                  <div className="mt-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Copy</p>
                    <p className="text-sm font-body whitespace-pre-line bg-card border border-border border-l-[3px] rounded-xl px-3 py-2.5 leading-relaxed"
                      style={{ borderLeftColor: card.marca.cor || "#4B3FA8" }}>{card.roteiro}</p>
                  </div>
                )}

                {/* AS ARTES DO CARROSSEL, uma a uma. Antes o card só dizia
                    "3 artes" e o texto de cada slide ficava do lado da social
                    mídia: o designer montava no escuro ou pedia por WhatsApp. */}
                {(() => {
                  const blocos = (Array.isArray(card.blocos) ? card.blocos : []) as { titulo?: string; texto?: string; conteudo?: string }[];
                  if (blocos.length === 0) return null;
                  return (
                    <div className="mt-4">
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        As artes, na ordem ({blocos.length})
                      </p>
                      <ol className="space-y-1.5">
                        {blocos.map((b, i) => (
                          <li key={i} className="text-sm font-body bg-muted/50 border border-border rounded-xl px-3 py-2 leading-relaxed">
                            <span className="font-display font-bold text-primary mr-1.5">{i + 1}.</span>
                            {b.titulo?.trim() && <b className="font-display">{b.titulo} </b>}
                            <span className="whitespace-pre-line">{(b.texto ?? b.conteudo ?? "").trim()}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })()}

                {card.legenda?.trim() && (
                  <div className="mt-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Legenda aprovada</p>
                    <p className="text-sm font-body whitespace-pre-line bg-card border border-border border-l-[3px] rounded-xl px-3 py-2.5 leading-relaxed"
                      style={{ borderLeftColor: card.marca.cor || "#4B3FA8" }}>{card.legenda}</p>
                    <button onClick={copiarLegenda} className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-body font-bold text-primary">
                      <CopyIcon className="h-3.5 w-3.5" /> Copiar legenda
                    </button>
                  </div>
                )}

                {/* DIREÇÃO DE ARTE E NOTAS: o RPC já mandava art e notes, mas a
                    tela jogava fora. Quem mais precisa deles é justamente o
                    designer (auditoria 07/09). */}
                {(() => {
                  const arte = card.arte as { resultado?: { estilo?: { descricao?: string }; paginas?: { n: number; titulo: string; pt: string }[] } } | null;
                  const estilo = arte?.resultado?.estilo?.descricao?.trim();
                  const paginas = arte?.resultado?.paginas ?? [];
                  if (!estilo && paginas.length === 0) return null;
                  return (
                    <div className="mt-4">
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Direção de arte</p>
                      <div className="text-sm font-body bg-muted/50 border border-border rounded-xl px-3 py-2.5 leading-relaxed space-y-2">
                        {estilo && <p>{estilo}</p>}
                        {paginas.length > 0 && (
                          <details>
                            <summary className="text-[12px] font-bold text-primary cursor-pointer">
                              {paginas.length} {paginas.length === 1 ? "cena descrita" : "cenas descritas"}
                            </summary>
                            <ol className="mt-1.5 space-y-1.5">
                              {paginas.map((pg) => (
                                <li key={pg.n} className="text-[12.5px]">
                                  <b>{pg.n}. {pg.titulo}</b>{pg.pt ? <> · {pg.pt}</> : null}
                                </li>
                              ))}
                            </ol>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {card.notas?.trim() && (
                  <div className="mt-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Observações da social mídia</p>
                    <p className="text-sm font-body whitespace-pre-line bg-amber-50/60 border border-amber-200 rounded-xl px-3 py-2.5 leading-relaxed">{card.notas}</p>
                  </div>
                )}

                {/* MEU CHECKLIST (privado): a paridade com o checklist do
                    Trello, que é o recurso que eles mais usam. Só o parceiro
                    vê; o progresso aparece no cartão do quadro. */}
                <div className="mt-4 rounded-xl border border-dashed border-violet-200 bg-violet-50/40 px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 flex items-center gap-1.5 mb-2">
                    Meu checklist <span className="ml-auto normal-case tracking-normal font-semibold text-violet-500/80">só você vê isto</span>
                  </p>
                  {(minhaMeta?.checklist ?? []).map((item, i) => (
                    <label key={i} className="flex items-center gap-2 py-1 text-[13px] font-body cursor-pointer group">
                      <input type="checkbox" checked={item.done} className="accent-violet-600 w-4 h-4"
                        onChange={() => {
                          const lista = [...(minhaMeta?.checklist ?? [])];
                          lista[i] = { ...lista[i], done: !lista[i].done };
                          salvarMeta.mutate({ postId: card.id, checklist: lista });
                        }} />
                      <span className={cn(item.done && "line-through text-muted-foreground")}>{item.t}</span>
                      <button type="button" aria-label="Remover item"
                        onClick={(e) => {
                          e.preventDefault();
                          const lista = (minhaMeta?.checklist ?? []).filter((_, j) => j !== i);
                          salvarMeta.mutate({ postId: card.id, checklist: lista });
                        }}
                        className="ml-auto opacity-0 group-hover:opacity-60 hover:opacity-100 text-muted-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </label>
                  ))}
                  <div className="flex items-center gap-2 mt-1.5">
                    <input value={novoItem} onChange={(e) => setNovoItem(e.target.value)} placeholder="+ item (ex.: cortar takes)"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && novoItem.trim()) {
                          salvarMeta.mutate({ postId: card.id, checklist: [...(minhaMeta?.checklist ?? []), { t: novoItem.trim(), done: false }] });
                          setNovoItem("");
                        }
                      }}
                      className="flex-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[12.5px] font-body" />
                  </div>
                </div>
              </div>

              {/* A COLUNA DA DIREITA: prazo, marca, material, ações. */}
              <div className="bg-muted/40 border-l border-border border-t-2 p-4 space-y-4 md:order-2 lg:overflow-y-auto" style={{ borderTopColor: `${card.marca.cor || "#4B3FA8"}55` }}>
                {/* O PRAZO É COMBINADO, NÃO IMPOSTO. Proposto = o parceiro topa
                    ou sugere outra data (com motivo, que entra na conversa);
                    negociando = a bola está com a social mídia. Enquanto isso,
                    o card segue produzível: negociar data não trava trabalho. */}
                {card.prazo_status === "proposto" && card.prazo_producao ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/70 px-3.5 py-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Prazo proposto
                    </p>
                    <p className="font-display font-extrabold text-lg text-amber-900">{dataBR(card.prazo_producao)}</p>
                    {!sugerindo ? (
                      <div className="space-y-1.5">
                        <Button size="sm" className="w-full rounded-xl" disabled={responderPrazo.isPending}
                          onClick={() => responderPrazo.mutate({ aceita: true })}>
                          {responderPrazo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" /> Topo esse prazo</>}
                        </Button>
                        <button type="button" onClick={() => setSugerindo(true)}
                          className="w-full text-[11.5px] font-body font-bold text-amber-800">
                          Sugerir outra data
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <input type="date" value={dataSugerida} onChange={(e) => setDataSugerida(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[12.5px] font-body" />
                        <input type="text" value={motivoPrazo} onChange={(e) => setMotivoPrazo(e.target.value)}
                          placeholder="Motivo (opcional, ex.: semana cheia)"
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[12.5px] font-body" />
                        <Button size="sm" className="w-full rounded-xl" disabled={!dataSugerida || responderPrazo.isPending}
                          onClick={() => { responderPrazo.mutate({ aceita: false, sugestao: dataSugerida, motivo: motivoPrazo }); setSugerindo(false); }}>
                          {responderPrazo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar sugestão"}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : card.prazo_status === "negociando" && card.prazo_sugerido ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Prazo em negociação
                    </p>
                    <p className="font-display font-extrabold text-lg mt-0.5 text-blue-900">{dataBR(card.prazo_sugerido)}</p>
                    <p className="text-[11px] font-body text-blue-800/80 mt-0.5">Você sugeriu. Aguardando a social mídia.</p>
                  </div>
                ) : (
                  <div className={cn("rounded-xl border px-3.5 py-3",
                    card.prazo_producao && card.prazo_producao <= hojeBR()
                      ? "bg-red-50 border-red-200" : "bg-background border-border")}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Clock className="h-3 w-3" /> Entrega combinada</p>
                    <p className={cn("font-display font-extrabold text-lg mt-0.5",
                      card.prazo_producao && card.prazo_producao <= hojeBR() ? "text-red-600" : "text-foreground")}>
                      {card.prazo_producao ? `${dataBR(card.prazo_producao)}` : "A combinar"}
                    </p>
                  </div>
                )}

                {/* O CACHÊ SAIU DAQUI (Walter, 09/09/2026): boa parte do
                    trabalho é fechada por PACOTE mensal, e um valor por peça
                    solto no card ou mentia sobre o combinado ou virava
                    negociação no meio da produção. Dinheiro fica no Caixa da
                    agência, que é onde o acerto acontece de verdade. */}

                {/* A MARCA VIROU UMA LINHA (Walter, 09/09/2026). Cor, hashtags
                    e logo eram repetidos em TODO card, e isso não é informação
                    de peça, é de cliente: agora mora na ficha da marca, em
                    "Marcas que atendo". Aqui fica o essencial pra reconhecer de
                    quem é a peça, e a porta pra ficha. */}
                <button type="button" onClick={() => navigate("/socialmidia/marcas")}
                  className="w-full flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3 text-left hover:border-primary/40 transition-colors">
                  <span className="w-8 h-8 rounded-full border border-border bg-card overflow-hidden grid place-items-center shrink-0"
                    style={{ background: card.marca.logo ? undefined : (card.marca.cor || "#4B3FA8") }}>
                    {card.marca.logo
                      ? <img src={card.marca.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
                      : <span className="text-white font-display font-bold text-[13px]">{(card.marca.nome || "C").charAt(0).toUpperCase()}</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-display font-bold text-foreground truncate">{card.marca.nome || "Cliente"}</span>
                    <span className="block text-[11px] font-body text-primary font-semibold">ver a ficha da marca</span>
                  </span>
                  {card.marca.cor && <span className="w-4 h-4 rounded-md border border-border shrink-0" style={{ background: card.marca.cor }} />}
                </button>

                {card.pasta_drive && (
                  <a href={card.pasta_drive} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3 text-sm font-body font-bold text-foreground hover:border-primary/40 transition-colors">
                    <Folder className="h-4 w-4 text-primary" /> Pasta de material
                    <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                  </a>
                )}
                {card.referencia && (
                  <a href={card.referencia} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3 text-sm font-body font-bold text-foreground hover:border-primary/40 transition-colors">
                    <Play className="h-4 w-4 text-primary" /> Referência
                    <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                  </a>
                )}

                <div className="pt-1 space-y-2">
                  {card.producao_status !== "entregue" ? (
                    !entregando ? (
                      <>
                        <Button className="w-full rounded-xl bg-green-600 hover:bg-green-700" disabled={marcar.isPending}
                          onClick={() => setEntregando(true)}>
                          <Check className="h-4 w-4 mr-1.5" /> Marcar como entregue
                        </Button>
                        {card.producao_status !== "em_producao" && (
                          <Button variant="outline" className="w-full rounded-xl" disabled={marcar.isPending}
                            onClick={() => marcar.mutate({ status: "em_producao" })}>
                            Estou fazendo
                          </Button>
                        )}
                      </>
                    ) : (
                      /* ENTREGA COM LINK: o antídoto do "qual arquivo é o
                         final?". O link da versão final entra carimbado na
                         conversa do card. */
                      <div className="rounded-xl border border-green-300 bg-green-50/60 p-2.5 space-y-2">
                        {/* Arquivo direto no card: imagem ou vídeo até 80 MB. Acima disso, link. */}
                        <input ref={inputArquivo} type="file" accept="image/*,video/*,.pdf" className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) { anexar.mutate({ arquivo: f, marcarEntregue: true }); setEntregando(false); }
                            e.target.value = "";
                          }} />
                        <Button className="w-full rounded-xl bg-green-600 hover:bg-green-700" disabled={anexar.isPending}
                          onClick={() => inputArquivo.current?.click()}>
                          {anexar.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Subindo...</> : <><Check className="h-4 w-4 mr-1.5" /> Subir o arquivo final e entregar</>}
                        </Button>
                        <p className="text-[10.5px] font-body text-muted-foreground text-center">ou</p>
                        <p className="text-[11px] font-body font-bold text-green-900">Link da versão final (Drive, Dropbox...)</p>
                        <input type="url" value={linkEntrega} onChange={(e) => setLinkEntrega(e.target.value)}
                          placeholder="https://..." inputMode="url"
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[12.5px] font-body" />
                        <Button variant="outline" className="w-full rounded-xl border-green-400 text-green-800 hover:bg-green-100" disabled={marcar.isPending || !linkEntrega.trim()}
                          onClick={() => { marcar.mutate({ status: "entregue", link: linkEntrega }); setEntregando(false); setLinkEntrega(""); }}>
                          {marcar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" /> Entregar com o link</>}
                        </Button>
                        <button type="button" className="w-full text-[11px] font-body font-semibold text-muted-foreground"
                          onClick={() => { marcar.mutate({ status: "entregue" }); setEntregando(false); }}>
                          Entregar sem link (está na pasta de material)
                        </button>
                      </div>
                    )
                  ) : (
                    <Button variant="outline" className="w-full rounded-xl" disabled={marcar.isPending}
                      onClick={() => marcar.mutate({ status: "em_producao" })}>
                      <RotateCcw className="h-4 w-4 mr-1.5" /> Reabrir (voltei a mexer)
                    </Button>
                  )}
                  <p className="text-[10.5px] font-body text-muted-foreground leading-relaxed">
                    Ao marcar entregue, a social mídia revisa e manda pro cliente aprovar. Se voltar,
                    volta com o motivo escrito no card, nunca por áudio perdido.
                  </p>
                </div>
              </div>
              {/* CONVERSA: coluna da DIREITA e chat de verdade. */}
              <ChatDoCard cor={card.marca.cor || "#4B3FA8"} mensagens={card.comentarios}
                texto={texto} setTexto={setTexto} enviar={enviar}
                enviando={comentar.isPending} anexando={anexar.isPending}
                aoMandarImagem={(arquivo) => anexar.mutate({ arquivo, naConversa: true, legenda: texto.trim() || undefined })}
                aoLimparTexto={() => setTexto("")} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

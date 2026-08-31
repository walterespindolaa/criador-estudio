import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  Copy as CopyIcon, ExternalLink, Folder, Loader2, MessageCircle, Palette,
  Play, RotateCcw, Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hojeBR } from "@/lib/date-br";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ROTULO_PAPEL, useAcoesDoParceiro, useCardDoParceiro, useFilaDoParceiro,
  useMinhasAgencias, type CardDaFila,
} from "@/hooks/useParceiro";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const { data: fila = [], isLoading } = useFilaDoParceiro();
  const { data: agencias = [] } = useMinhasAgencias();
  const [aberto, setAberto] = useState<string | null>(null);
  const [visao, setVisao] = useState<"prazo" | "quadro" | "semana" | "mes">("prazo");
  const hoje = hojeBR();
  const grupos = useMemo(() => porDia(fila), [fila]);
  const venceHoje = fila.filter((c) => c.prazo_producao === hoje).length;
  const fazendo = fila.filter((c) => c.producao_status === "em_producao").length;
  const emAjuste = fila.filter((c) => c.producao_status === "ajuste").length;
  const entregues30 = agencias.reduce((t, a) => t + a.entregues_30d, 0);

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* O título mora na faixa hero do ParceiroLayout; aqui começa direto
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
              {agencias.map((a) => (
                <Card key={a.agencia_id} className="rounded-2xl border-border px-3.5 py-2.5 flex items-center gap-3 shrink-0">
                  <span className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-white grid place-items-center text-xs font-bold shrink-0">
                    {a.agencia_nome.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-body font-bold text-foreground truncate max-w-[160px]">{a.agencia_nome}</span>
                    <span className="block text-[11px] font-body text-muted-foreground">
                      {ROTULO_PAPEL[a.meu_papel] ?? a.meu_papel} · {a.abertos} na mão · {a.entregues_30d} entregues/30d
                    </span>
                  </span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* O SELETOR DE VISÃO: as quatro do mockup aprovado. Pílulas no accent,
            como as abas do resto do app. */}
        <div className="inline-flex gap-1 rounded-full border border-border bg-card p-1 mb-4 flex-wrap">
          {([["prazo", "Por prazo"], ["quadro", "Quadro"], ["semana", "Semana"], ["mes", "Mês"]] as const).map(([v, r]) => (
            <button key={v} type="button" onClick={() => setVisao(v)}
              className={cn("px-4 py-1.5 rounded-full text-[13px] font-display font-semibold transition-colors",
                visao === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {r}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : fila.length === 0 ? (
          <ComeceAqui />
        ) : visao === "semana" ? (
          <SemanaDoParceiro fila={fila} hoje={hoje} aoAbrir={setAberto} />
        ) : visao === "quadro" ? (
          <QuadroDoParceiro fila={fila} hoje={hoje} aoAbrir={setAberto} />
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

/* ── O QUADRO (estilo Trello) ─────────────────────────────────────────────
   Colunas por etapa de produção, como o quadro que a Gabriela montava no
   Trello: Novo, Fazendo, Ajuste e Entregue. As três primeiras vêm da fila; a
   de Entregue puxa o histórico recente (a fila esconde entregue de propósito).
   O card anda pelas ações de dentro dele (Estou fazendo / Marcar entregue),
   não por arrasto: quem decide etapa é o trabalho, não o mouse. */
function QuadroDoParceiro({ fila, hoje, aoAbrir }: {
  fila: CardDaFila[]; hoje: string; aoAbrir: (id: string) => void;
}) {
  const { user } = useAuth();
  // Mesma chave da tela Entregues: compartilha o cache, sem consulta dobrada.
  const { data: entregues = [] } = useQuery<{ post_id: string; titulo: string; cliente_nome: string; cliente_cor: string | null; entregue_em: string }[]>({
    queryKey: ["parceiro-entregues", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("parceiro_entregues");
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return [];
        throw error;
      }
      return data ?? [];
    },
  });

  const COLUNAS = [
    { chave: "aguardando", rotulo: "Novo", cor: "bg-orange-500", fundo: "bg-orange-50/70" },
    { chave: "em_producao", rotulo: "Fazendo", cor: "bg-blue-500", fundo: "bg-blue-50/70" },
    { chave: "ajuste", rotulo: "Ajuste", cor: "bg-violet-500", fundo: "bg-violet-50/70" },
  ] as const;

  const cartao = (c: CardDaFila) => {
    const atrasado = c.prazo_producao && c.prazo_producao < hoje;
    return (
      <button key={c.post_id} onClick={() => aoAbrir(c.post_id)}
        className="w-full text-left rounded-xl border border-border bg-card px-3 py-2.5 mb-2 shadow-sm hover:shadow transition-shadow">
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
        </span>
      </button>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
      {COLUNAS.map((col) => {
        const cards = fila.filter((c) => c.producao_status === col.chave);
        return (
          <div key={col.chave} className={cn("rounded-2xl border border-border p-2.5", col.fundo)}>
            <p className="flex items-center gap-2 px-1 pb-2">
              <span className={cn("w-2 h-2 rounded-full", col.cor)} />
              <span className="font-display font-bold text-[13px]">{col.rotulo}</span>
              <span className="ml-auto text-[10px] font-bold text-muted-foreground bg-card rounded-full px-2 py-0.5 border border-border">{cards.length}</span>
            </p>
            {cards.length === 0
              ? <p className="text-[11px] font-body text-muted-foreground/60 text-center py-6">vazio</p>
              : cards.map(cartao)}
          </div>
        );
      })}
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
    </div>
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

function CardAbertoDialog({ postId, aoFechar }: { postId: string | null; aoFechar: () => void }) {
  const { data: card, isLoading } = useCardDoParceiro(postId);
  const { marcar, comentar, responderPrazo } = useAcoesDoParceiro(postId);
  const [texto, setTexto] = useState("");
  // Entregar em dois tempos: o clique abre o campo do link da versão final.
  const [entregando, setEntregando] = useState(false);
  const [linkEntrega, setLinkEntrega] = useState("");
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

  const copiarLegenda = async () => {
    if (!card?.legenda) return;
    await navigator.clipboard.writeText(card.legenda);
    toast.success("Legenda copiada.");
  };

  return (
    <Dialog open={!!postId} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-3xl p-0 gap-0 rounded-2xl overflow-hidden max-h-[88vh] overflow-y-auto">
        {isLoading || !card ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Capa na cor do cliente: o parceiro sabe de quem é antes de ler. */}
            <div className="h-24 shrink-0" style={{ background: `linear-gradient(135deg, ${card.marca.cor || "#4B3FA8"}, ${card.marca.cor || "#4B3FA8"}cc)` }} />
            <div className="grid md:grid-cols-[1fr_260px]">
              <div className="p-5">
                <DialogTitle className="font-display text-xl font-extrabold leading-tight">{card.titulo || "Sem título"}</DialogTitle>
                <p className="text-xs font-body text-muted-foreground mt-1.5">
                  <b className="text-foreground">{card.marca.nome}</b> · delegado por {card.agencia}
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
                  {/* Depois que saiu da mão dele, onde a peça está. Fim da
                      cegueira pós-entrega. */}
                  {card.producao_status === "entregue" && card.aprovacao && ROTULO_APROVACAO[card.aprovacao] && (
                    <span className={cn("text-[10.5px] font-bold px-2 py-1 rounded-full", ROTULO_APROVACAO[card.aprovacao].cls)}>
                      {ROTULO_APROVACAO[card.aprovacao].txt}
                    </span>
                  )}
                </div>

                {card.gancho?.trim() && (
                  <div className="mt-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Gancho</p>
                    <p className="text-sm font-body bg-muted/50 border border-border rounded-xl px-3 py-2.5">{card.gancho}</p>
                  </div>
                )}

                {card.roteiro?.trim() && (
                  <div className="mt-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Roteiro</p>
                    <p className="text-sm font-body whitespace-pre-line bg-muted/50 border border-border rounded-xl px-3 py-2.5 leading-relaxed">{card.roteiro}</p>
                  </div>
                )}

                {card.legenda?.trim() && (
                  <div className="mt-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Legenda aprovada</p>
                    <p className="text-sm font-body whitespace-pre-line bg-muted/50 border border-border rounded-xl px-3 py-2.5 leading-relaxed">{card.legenda}</p>
                    <button onClick={() => void copiarLegenda()} className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-body font-bold text-primary">
                      <CopyIcon className="h-3.5 w-3.5" /> Copiar legenda
                    </button>
                  </div>
                )}

                {/* Conversa: as três vozes com etiqueta. É o fim do telefone sem fio. */}
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5" /> Conversa deste card
                  </p>
                  {card.comentarios.length === 0 && (
                    <p className="text-xs font-body text-muted-foreground mb-3">Nenhum comentário ainda.</p>
                  )}
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {card.comentarios.map((cm) => (
                      <div key={cm.id} className="rounded-xl border border-border bg-background px-3 py-2">
                        <p className="text-[10.5px] font-bold mb-0.5">
                          <span className={cn("px-1.5 py-0.5 rounded-full uppercase tracking-wide text-[9px]",
                            cm.papel === "parceiro" ? "bg-violet-100 text-violet-700"
                            : cm.papel === "cliente" || cm.papel === "client" ? "bg-green-100 text-green-700"
                            : "bg-pink-100 text-pink-700")}>
                            {cm.papel === "parceiro" ? "você" : (cm.papel === "cliente" || cm.papel === "client") ? "cliente" : "social mídia"}
                          </span>
                          <span className="text-muted-foreground font-medium ml-2">{new Date(cm.em).toLocaleDateString("pt-BR")}</span>
                        </p>
                        <p className="text-[13px] font-body leading-relaxed">{cm.texto}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1}
                      placeholder="Escrever um comentário... a social mídia recebe na hora"
                      className="rounded-xl resize-none min-h-[42px] text-sm" />
                    <Button size="sm" onClick={() => void enviar()} disabled={!texto.trim() || comentar.isPending} className="rounded-xl h-[42px]">
                      {comentar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* A COLUNA DA DIREITA: prazo, marca, material, ações. */}
              <div className="bg-muted/40 border-l border-border p-4 space-y-4">
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

                <div className="rounded-xl border border-border bg-background px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2"><Palette className="h-3 w-3" /> A marca</p>
                  {card.marca.cor && (
                    <button
                      onClick={() => { void navigator.clipboard.writeText(card.marca.cor!); toast.success(`${card.marca.cor} copiado.`); }}
                      className="flex items-center gap-2 mb-2" title="Copiar o hex">
                      <span className="w-7 h-7 rounded-lg border border-border" style={{ background: card.marca.cor }} />
                      <span className="text-xs font-mono text-muted-foreground">{card.marca.cor}</span>
                    </button>
                  )}
                  {card.marca.handle && <p className="text-xs font-body text-muted-foreground">@{card.marca.handle.replace(/^@/, "")}</p>}
                  {(card.marca.hashtags?.length ?? 0) > 0 && (
                    <p className="text-[11px] font-body text-muted-foreground mt-1.5 leading-relaxed">{card.marca.hashtags!.slice(0, 6).join(" ")}</p>
                  )}
                </div>

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
                        <p className="text-[11px] font-body font-bold text-green-900">Link da versão final (Drive, Dropbox...)</p>
                        <input type="url" value={linkEntrega} onChange={(e) => setLinkEntrega(e.target.value)}
                          placeholder="https://..." inputMode="url"
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[12.5px] font-body" />
                        <Button className="w-full rounded-xl bg-green-600 hover:bg-green-700" disabled={marcar.isPending}
                          onClick={() => { marcar.mutate({ status: "entregue", link: linkEntrega }); setEntregando(false); setLinkEntrega(""); }}>
                          {marcar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" /> Confirmar entrega</>}
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
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

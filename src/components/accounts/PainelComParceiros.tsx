import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, CheckCircle2, Clock, KanbanSquare, List, Loader2, Send, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { hojeBR } from "@/lib/date-br";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useExternalClients, type ExternalClient } from "@/hooks/useCriaPost";
import {
  ROTULO_PAPEL, useCachesDosParceiros, useMeusParceiros, usePecasComParceiros, useResolverPrazoSugerido,
  type PecaExterna,
} from "@/hooks/useParceiro";

const brl = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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


/* ═══════════════════════════════════════════════════════════════════════════
   O QUADRO DO PARCEIRO, COLUNA POR CLIENTE (Walter, 20/09/2026)

   A Gabriela tem um board no Trello chamado "DESIGN - Ágatha Chagas": uma
   coluna por cliente, e dentro os cards que estão com a designer, cada um com
   a etiqueta da etapa. É assim que ela bate o olho e sabe o que a Ágatha tem
   de cada cliente na mão. A lista de cima responde "o que está atrasado";
   o quadro responde "como está a entrega de cada prestador, por cliente".

   Uma pessoa por vez, escolhida nas pílulas. Colunas = clientes que têm peça
   com ela. Não tem arrastar, de propósito: a etapa quem move é o parceiro na
   área dele. Aqui é leitura. Clicar no card abre a peça.

   Entregues aparecem embaixo, apagadas, só as dos últimos 30 dias: é o
   "Aprovado" do Trello dela, o que já saiu mas ainda é do mês.
   ═══════════════════════════════════════════════════════════════════════════ */
const ORDEM_ETAPA: Record<string, number> = { ajuste: 0, aguardando: 1, em_producao: 2, entregue: 3 };

function QuadroDoParceiro({ parceiros, pecas, extClients, hoje, abrirPeca, nomeParceiro }: {
  parceiros: { member_id: string; nome: string; role: string }[];
  pecas: PecaExterna[];
  extClients: ExternalClient[];
  hoje: string;
  abrirPeca: (p: PecaExterna) => void;
  nomeParceiro: Map<string, { nome: string; role: string }>;
}) {
  const [quem, setQuem] = useState<string>(parceiros[0]?.member_id ?? "");
  useEffect(() => {
    if (!parceiros.some((p) => p.member_id === quem)) setQuem(parceiros[0]?.member_id ?? "");
  }, [parceiros, quem]);

  const limite30 = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString();
  }, []);

  const minhas = useMemo(() => pecas.filter((p) => p.assignee_id === quem), [pecas, quem]);

  const colunas = useMemo(() => {
    const mapa = new Map<string, { abertas: PecaExterna[]; entregues: PecaExterna[] }>();
    for (const p of minhas) {
      const k = p.external_client_id ?? "sem-cliente";
      const c = mapa.get(k) ?? { abertas: [], entregues: [] };
      if (p.producao_status === "entregue") {
        if ((p.entregue_em ?? p.updated_at ?? "") >= limite30) c.entregues.push(p);
      } else c.abertas.push(p);
      mapa.set(k, c);
    }
    const ordenar = (a: PecaExterna, b: PecaExterna) => {
      const e = (ORDEM_ETAPA[a.producao_status ?? ""] ?? 9) - (ORDEM_ETAPA[b.producao_status ?? ""] ?? 9);
      if (e !== 0) return e;
      return (a.prazo_producao ?? "9999").localeCompare(b.prazo_producao ?? "9999");
    };
    return [...mapa.entries()]
      .filter(([, c]) => c.abertas.length + c.entregues.length > 0)
      .map(([id, c]) => ({
        id,
        cliente: extClients.find((e) => e.id === id) ?? null,
        abertas: c.abertas.sort(ordenar),
        entregues: c.entregues,
        atrasadas: c.abertas.filter((p) => p.prazo_producao && diasAte(p.prazo_producao, hoje) < 0).length,
      }))
      // Quem tem mais coisa aberta vem primeiro; atrasada desempata.
      .sort((a, b) => (b.atrasadas - a.atrasadas) || (b.abertas.length - a.abertas.length));
  }, [minhas, extClients, limite30, hoje]);

  const cargaDe = (id: string) => {
    const lista = pecas.filter((p) => p.assignee_id === id && p.producao_status !== "entregue");
    return { abertas: lista.length, atrasadas: lista.filter((p) => p.prazo_producao && diasAte(p.prazo_producao, hoje) < 0).length };
  };

  const cartao = (p: PecaExterna, apagado = false) => {
    const d = p.prazo_producao ? diasAte(p.prazo_producao, hoje) : null;
    return (
      <button key={p.id} type="button" onClick={() => abrirPeca(p)}
        className={cn(
          "w-full text-left rounded-xl border bg-card p-3 shadow-sm hover:shadow-md hover:-translate-y-px transition-all",
          apagado ? "opacity-60 border-border" : d !== null && d < 0 ? "border-red-300" : "border-border",
        )}>
        <span className="flex items-center gap-1.5 flex-wrap mb-1.5">
          {p.producao_status && ETAPA[p.producao_status] && (
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", ETAPA[p.producao_status].cls)}>
              {ETAPA[p.producao_status].txt}
            </span>
          )}
          {p.format && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{FORMATO[p.format] ?? p.format}</span>}
          {(p.revisoes ?? 0) > 0 && (
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
              (p.revisoes ?? 0) >= 3 ? "bg-red-100 text-red-700" : "bg-violet-100 text-violet-700")}>
              {p.revisoes}ª rev.
            </span>
          )}
        </span>
        <span className="block font-display font-bold text-[13px] leading-snug line-clamp-3">{p.title || "Sem título"}</span>
        <span className="block mt-2">
          {apagado
            ? <span className="text-[11px] font-body text-muted-foreground">entregue {p.entregue_em ? new Date(p.entregue_em).toLocaleDateString("pt-BR") : ""}</span>
            : <ContagemPrazo prazo={p.prazo_producao} hoje={hoje} />}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* Quem: uma pílula por parceiro, com a carga dele. */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {parceiros.map((pc) => {
          const carga = cargaDe(pc.member_id);
          const ativa = pc.member_id === quem;
          return (
            <button key={pc.member_id} type="button" onClick={() => setQuem(pc.member_id)}
              className={cn(
                "shrink-0 inline-flex items-center gap-2 rounded-full border pl-1.5 pr-3 py-1.5 transition-colors",
                ativa ? "bg-violet-600 border-violet-600 text-white shadow-md" : "bg-card border-border hover:border-violet-300",
              )}>
              <span className={cn("w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold",
                ativa ? "bg-white/20 text-white" : "bg-gradient-to-br from-violet-400 to-violet-700 text-white")}>
                {pc.nome.charAt(0).toUpperCase()}
              </span>
              <span className="text-[13px] font-display font-semibold whitespace-nowrap">{pc.nome.split(" ")[0]}</span>
              <span className={cn("text-[10.5px] font-body", ativa ? "text-white/80" : "text-muted-foreground")}>
                {ROTULO_PAPEL[pc.role] ?? pc.role}
              </span>
              <span className={cn("text-[10.5px] font-bold tabular-nums rounded-full px-1.5 py-0.5",
                ativa ? "bg-white/25 text-white" : "bg-muted text-muted-foreground")}>
                {carga.abertas}
              </span>
              {carga.atrasadas > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white">{carga.atrasadas} atrasada{carga.atrasadas === 1 ? "" : "s"}</span>
              )}
            </button>
          );
        })}
      </div>

      {colunas.length === 0 ? (
        <Card className="p-8 rounded-2xl border-dashed text-center">
          <p className="text-sm font-body font-medium text-foreground">
            Nada com {nomeParceiro.get(quem)?.nome.split(" ")[0] ?? "este parceiro"} agora
          </p>
          <p className="text-xs text-muted-foreground font-body mt-1">Delegue pelo "Enviar para" dentro do post.</p>
        </Card>
      ) : (
        /* Trilho horizontal, igual ao quadro do parceiro: uma coluna por cliente,
           78vw no celular, 260px no desktop. */
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
          {colunas.map((col) => {
            const cor = col.cliente?.color || col.cliente?.brand_color || null;
            return (
              <div key={col.id} className="w-[78vw] max-w-[260px] shrink-0 snap-start rounded-2xl bg-muted/40 border border-border p-2.5">
                <div className="flex items-center gap-2 px-1 mb-2.5">
                  {col.cliente?.logo_url
                    ? <img src={col.cliente.logo_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                    : <span className="w-6 h-6 rounded-full shrink-0 grid place-items-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: cor ?? "#9ca3af" }}>
                        {(col.cliente?.name ?? "?").charAt(0).toUpperCase()}
                      </span>}
                  <span className="font-display font-bold text-[13px] truncate flex-1">{col.cliente?.name ?? "Sem cliente"}</span>
                  <span className="text-[10.5px] font-bold tabular-nums rounded-full px-1.5 py-0.5 bg-card border border-border text-muted-foreground">{col.abertas.length}</span>
                  {col.atrasadas > 0 && <span className="w-2 h-2 rounded-full bg-red-600" title={`${col.atrasadas} atrasada(s)`} />}
                </div>
                <div className="space-y-2">
                  {col.abertas.map((p) => cartao(p))}
                  {col.entregues.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 pt-1">Entregues · 30 dias</p>
                      {col.entregues.map((p) => cartao(p, true))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PainelComParceiros({ clientes }: {
  /** id do external_client → nome, vindo de quem monta a tela. */
  clientes: Record<string, string>;
}) {
  const navigate = useNavigate();
  // Só pra traduzir external_client_id -> crm_client_id na hora de abrir a peça.
  const { clients: extClients } = useExternalClients();
  const { data: parceiros = [] } = useMeusParceiros();
  const { data: pecas = [], isLoading } = usePecasComParceiros(parceiros.length > 0);
  const resolver = useResolverPrazoSugerido();
  /* Lista ou quadro, lembrado no navegador. O quadro é o jeito que a Gabriela
     já usa no Trello, então é o padrão. */
  const [visao, setVisao] = useState<"quadro" | "lista">(() => {
    try { return localStorage.getItem("cria.parceiros.visao") === "lista" ? "lista" : "quadro"; } catch { return "quadro"; }
  });
  const trocarVisao = (v: "quadro" | "lista") => { setVisao(v); try { localStorage.setItem("cria.parceiros.visao", v); } catch { /* sem storage */ } };
  const hoje = hojeBR();
  // Cachês (fase 3): despesas do Caixa ligadas a parceiro, agrupadas por pessoa.
  const { agencyOwnerId } = useActiveAccount();
  const { data: caches = [] } = useCachesDosParceiros(agencyOwnerId);
  const cachesPorParceiro = useMemo(() => {
    const m = new Map<string, { pendente: number; pago: number; qtd: number }>();
    for (const c of caches) {
      const a = m.get(c.assignee_id) ?? { pendente: 0, pago: 0, qtd: 0 };
      if (c.status === "pago") a.pago += Number(c.amount); else { a.pendente += Number(c.amount); a.qtd++; }
      m.set(c.assignee_id, a);
    }
    return m;
  }, [caches]);
  const totalCachePendente = [...cachesPorParceiro.values()].reduce((s, a) => s + a.pendente, 0);

  const nomeParceiro = useMemo(() => {
    const m = new Map<string, { nome: string; role: string }>();
    for (const p of parceiros) m.set(p.member_id, { nome: p.nome, role: p.role });
    return m;
  }, [parceiros]);

  // O que exige ação DELA, sempre em cima.
  // Entregue e ainda não foi pro cliente. Inclui o caso "cliente pediu ajuste,
  // parceiro entregou de novo": approval_status fica ajuste_solicitado e antes
  // a peça sumia desta lista (auditoria 07/09).
  const praRevisar = pecas.filter((p) => p.producao_status === "entregue" && !["pendente", "aprovado", "postado"].includes(p.approval_status ?? ""));
  const prazosPraResponder = pecas.filter((p) => p.prazo_status === "negociando" && p.prazo_sugerido);
  const abertas = pecas.filter((p) => p.producao_status !== "entregue");
  /* ENTREGUE SEM CACHÊ (Walter, 14/09/2026): o parceiro fez o trabalho e a peça
     não entrou no Caixa nem no "a receber" dele. Sem esta lista, o furo só
     aparece quando ele cobra, e aí a conversa já começa errada. */
  const semCache = pecas.filter((p) => p.producao_status === "entregue" && !Number(p.cache_parceiro ?? 0));

  const porParceiro = useMemo(() => {
    const mapa = new Map<string, PecaExterna[]>();
    for (const p of abertas) mapa.set(p.assignee_id, [...(mapa.get(p.assignee_id) ?? []), p]);
    return [...mapa.entries()];
  }, [abertas]);

  if (parceiros.length === 0) return null;

  /* CLIQUE MORTO, ACHADO NA REVISÃO DE 14/09/2026.
     A rota é /socialmidia/clientes/<id do CRM>/posts, mas aqui ia o id do
     external_clients. A tela procurava um cliente do CRM com esse id, não
     achava, e a pessoa caía numa página vazia sem entender por quê. Agora
     traduz um id no outro antes de navegar.
     E `?post=` abre o editor DAQUELA peça, em vez de largar ela num kanban com
     dezenas de cards pra achar o título de novo na mão. */
  const abrirPeca = (p: PecaExterna) => {
    const ec = p.external_client_id ? extClients.find((c) => c.id === p.external_client_id) : null;
    if (ec?.crm_client_id) navigate(`/socialmidia/clientes/${ec.crm_client_id}/posts?post=${p.id}`);
    else navigate("/socialmidia/criapost"); // sem cliente no CRM: o quadro geral, nunca clique morto
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
          {/* QUANTAS VEZES ESTA PEÇA VOLTOU (Walter, 14/09/2026). Sem este
              número, revisão vira sensação: ela lembra que "esse cliente pede
              muito ajuste" mas não tem o que mostrar numa conversa de escopo.
              A partir da terceira, o chip fica vermelho: aí não é capricho do
              cliente, é briefing que saiu errado. */}
          {(p.revisoes ?? 0) > 0 && (
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
              (p.revisoes ?? 0) >= 3 ? "bg-red-100 text-red-700" : "bg-violet-100 text-violet-700")}>
              {p.revisoes}ª revisão
            </span>
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
                    {/* entregue_em é gravado na transição de status. `updated_at`
                        mudava a cada edição e mostrava a data errada aqui. */}
                    entregue {p.entregue_em ? new Date(p.entregue_em).toLocaleDateString("pt-BR") : ""}
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

          {/* ── 2b. ENTREGUE SEM CACHÊ COMBINADO ── */}
          {semCache.length > 0 && (
            <section>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-2 px-0.5">
                <Wallet className="h-3.5 w-3.5" /> Entregas sem cachê combinado ({semCache.length})
              </p>
              <Card className="rounded-2xl border-amber-200 bg-amber-50/50 overflow-hidden divide-y divide-amber-100">
                {semCache.map((p) => linhaPeca(p,
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 rounded-full px-2.5 py-1">
                    definir valor
                  </span>))}
              </Card>
              <p className="text-[11px] font-body text-muted-foreground mt-1.5 px-0.5">
                Enquanto o valor estiver em branco, a peça não entra no seu Caixa nem no "a receber" do parceiro.
                Abra o post e preencha o cachê no "Enviar para": corrigir ali não desfaz a entrega.
              </p>
            </section>
          )}

          {/* ── 3. NA MÃO DE CADA PARCEIRO: quadro por cliente ou lista ── */}
          <section>
            <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Na mão de cada parceiro
              </p>
              <div className="inline-flex rounded-full border border-border bg-card p-0.5">
                {([["quadro", KanbanSquare, "Quadro"], ["lista", List, "Lista"]] as const).map(([v, Icone, rotulo]) => (
                  <button key={v} type="button" onClick={() => trocarVisao(v)}
                    className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-body font-semibold transition-colors",
                      visao === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    <Icone className="h-3.5 w-3.5" /> {rotulo}
                  </button>
                ))}
              </div>
            </div>

            {visao === "quadro" ? (
              <QuadroDoParceiro
                parceiros={parceiros}
                pecas={pecas}
                extClients={extClients as ExternalClient[]}
                hoje={hoje}
                abrirPeca={abrirPeca}
                nomeParceiro={nomeParceiro}
              />
            ) : porParceiro.length === 0 && praRevisar.length === 0 ? (
              <Card className="p-10 rounded-2xl border-dashed text-center">
                <Users className="h-7 w-7 mx-auto text-muted-foreground mb-2.5" />
                <p className="text-sm font-body font-medium text-foreground">Nada com parceiros agora</p>
                <p className="text-xs text-muted-foreground font-body mt-1 max-w-md mx-auto">
                  Delegue um post pelo botão <b>Enviar para</b> dentro do editor: ele aparece aqui com a
                  etapa e a contagem do prazo, e o parceiro recebe o aviso na hora.
                </p>
              </Card>
            ) : (
              <div className="space-y-5">
                {porParceiro.map(([assigneeId, lista]) => {
                  const quem = nomeParceiro.get(assigneeId);
                  const atrasadas = lista.filter((p) => p.prazo_producao && diasAte(p.prazo_producao, hoje) < 0).length;
                  return (
                    <div key={assigneeId}>
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
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── 4. CACHÊS: o que você deve aos parceiros (nasce ao entregar) ── */}
          {cachesPorParceiro.size > 0 && (
            <section>
              <p className="flex items-center gap-2 mb-2 px-0.5">
                <Wallet className="h-4 w-4 text-green-700" />
                <span className="font-display font-bold text-[14px]">Cachês dos parceiros</span>
                {totalCachePendente > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{brl(totalCachePendente)} a pagar</span>
                )}
              </p>
              <Card className="rounded-2xl border-border overflow-hidden divide-y divide-border">
                {[...cachesPorParceiro.entries()].map(([id, a]) => {
                  const quem = nomeParceiro.get(id);
                  return (
                    <button key={id} type="button" onClick={() => navigate("/socialmidia/criacaixa/empresa")}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors">
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-violet-700 text-white grid place-items-center text-[10px] font-bold shrink-0">
                        {(quem?.nome ?? "P").charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display font-bold text-[13.5px] leading-tight truncate">{quem?.nome ?? "Parceiro"}</span>
                        <span className="block text-[11px] font-body text-muted-foreground">
                          {a.qtd > 0 ? `${a.qtd} entrega${a.qtd > 1 ? "s" : ""} a pagar` : "Em dia"} · {brl(a.pago)} já pago
                        </span>
                      </span>
                      <span className={cn("text-[13px] font-display font-extrabold shrink-0", a.pendente > 0 ? "text-amber-800" : "text-green-700")}>
                        {a.pendente > 0 ? brl(a.pendente) : "ok"}
                      </span>
                    </button>
                  );
                })}
              </Card>
              <p className="text-[11px] font-body text-muted-foreground px-0.5 mt-1.5">
                Cada cachê é uma despesa no Caixa (categoria pelo papel do parceiro, ligada ao cliente). Marque como pago lá, e o parceiro vê na área dele.
              </p>
            </section>
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

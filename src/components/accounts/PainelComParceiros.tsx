import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarDays, Check, CheckCircle2, Clock, KanbanSquare, List, Loader2, MessageCircle, Send, Users, Wallet } from "lucide-react";
import { CardAbertoDialog } from "@/pages/app/MinhasDemandas";
import { ManagerCalendar } from "@/components/accounts/ManagerCalendar";
import { cn } from "@/lib/utils";
import { hojeBR } from "@/lib/date-br";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useExternalClients, type ExternalClient } from "@/hooks/useCriaPost";
import {
  ROTULO_PAPEL, useCachesDosParceiros, useConversasComParceiros, useMeusParceiros, usePecasComParceiros, useResolverPrazoSugerido,
  type PecaExterna,
} from "@/hooks/useParceiro";
import { brlReais } from "@/lib/money";
import { FORMAT_CHIP_SOLID_CLASS, formatColorVars } from "@/lib/format-colors";
import { useMarcaDosClientes } from "@/hooks/useParceiro";
import { AcoesDeRevisao } from "@/components/accounts/RevisaoDaEntrega";

const brl = brlReais;

/* ETIQUETA DE FORMATO NA COR DO FORMATO (Walter, 29/09/2026: "deixar
   coloridinho as etiquetas de formato"). Mesma língua do resto do app:
   carrossel verde, reels azul, estático laranja. */
function ChipFormato({ formato, className }: { formato: string | null; className?: string }) {
  if (!formato) return null;
  return (
    <span style={formatColorVars(formato)}
      className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", FORMAT_CHIP_SOLID_CLASS, className)}>
      {FORMATO[formato] ?? formato}
    </span>
  );
}

/* O CACHÊ À VISTA NO CARD (Walter, 29/09/2026: "acabei não colocando de uns,
   queria revisar todos"). Com valor: discreto. Sem valor: âmbar, pra saltar. */
function ChipCache({ valor }: { valor: number | null }) {
  const n = Number(valor ?? 0);
  return n > 0
    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200 tabular-nums">{brl(n)}</span>
    : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">sem cachê</span>;
}

/* Fundo "beeem clarinho" da cor do cliente (Walter, 29/09/2026). Só aceita
   hex de 6 dígitos: é o que a ficha grava; qualquer outra coisa cai no cinza
   padrão em vez de virar CSS inválido. */
function tintaDoCliente(cor: string | null | undefined): React.CSSProperties | undefined {
  if (!cor || !/^#[0-9a-f]{6}$/i.test(cor)) return undefined;
  return { backgroundColor: `${cor}14`, borderColor: `${cor}40` };
}

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
  const { data: marcas } = useMarcaDosClientes(extClients.map((c) => c.crm_client_id ?? "").filter(Boolean));

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
          <ChipFormato formato={p.format} />
          {(p.revisoes ?? 0) > 0 && (
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
              (p.revisoes ?? 0) >= 3 ? "bg-red-100 text-red-700" : "bg-violet-100 text-violet-700")}>
              {p.revisoes}ª rev.
            </span>
          )}
          <ChipCache valor={p.cache_parceiro} />
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
            // A ficha do CRM manda (é onde a Gabriela cadastra logo e cor);
            // o portal é o reserva.
            const ficha = col.cliente?.crm_client_id ? marcas?.get(col.cliente.crm_client_id) : undefined;
            const cor = ficha?.color || col.cliente?.color || col.cliente?.brand_color || null;
            const logo = ficha?.logo || col.cliente?.logo_url || null;
            const tinta = tintaDoCliente(cor);
            return (
              <div key={col.id} style={tinta}
                className={cn("w-[78vw] max-w-[260px] shrink-0 snap-start rounded-2xl border p-2.5", tinta ? "" : "bg-muted/40 border-border")}>
                <div className="flex items-center gap-2 px-1 mb-2.5">
                  {logo
                    ? <img src={logo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 bg-white ring-1 ring-black/5" />
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


/* ═══════════════════════════════════════════════════════════════════════════
   O QUADRO DE PRODUÇÃO, TODO MUNDO JUNTO (Walter, 28/09/2026: "o kanban onde
   eu vejo o que tá com ele, achar um lugar melhor")

   O quadro de antes mostrava UM parceiro por vez, com uma coluna por cliente:
   bom pra conferir a carga da designer, ruim pra responder "o que está em
   ajuste agora?" sem clicar em cada pessoa. Este é o kanban da operação:

     Novo · Fazendo · Ajuste · Entregue (30 dias)

   com filtro por parceiro e por cliente em cima. É leitura, de propósito: a
   etapa quem move é o parceiro (Estou fazendo, Marcar entregue) e o ajuste
   quem pede é ela, dentro do card. Clicar abre o card com a conversa.
   A visão antiga (colunas por cliente) continua no "Agrupar por cliente".
   ═══════════════════════════════════════════════════════════════════════════ */
const COLUNAS_ETAPA: { etapa: string; titulo: string; fundo: string; ponto: string }[] = [
  { etapa: "aguardando", titulo: "Novo", fundo: "bg-orange-50/60", ponto: "bg-orange-500" },
  { etapa: "em_producao", titulo: "Fazendo", fundo: "bg-blue-50/60", ponto: "bg-blue-500" },
  { etapa: "ajuste", titulo: "Ajuste", fundo: "bg-violet-50/60", ponto: "bg-violet-500" },
  { etapa: "entregue", titulo: "Entregue · 30 dias", fundo: "bg-green-50/60", ponto: "bg-green-600" },
];

function QuadroDeProducao({ parceiros, pecas, extClients, hoje, abrirPeca, nomeParceiro, naoLidas }: {
  parceiros: { member_id: string; nome: string; role: string }[];
  pecas: PecaExterna[];
  extClients: ExternalClient[];
  hoje: string;
  abrirPeca: (p: PecaExterna) => void;
  nomeParceiro: Map<string, { nome: string; role: string }>;
  naoLidas: Map<string, number>;
}) {
  const [quem, setQuem] = useState<string>("todos");
  const [cliente, setCliente] = useState<string>("todos");
  const limite30 = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString();
  }, []);

  const clientesComPeca = useMemo(() => {
    const ids = new Set(pecas.map((p) => p.external_client_id).filter(Boolean) as string[]);
    return extClients.filter((c) => ids.has(c.id)).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [pecas, extClients]);

  const visiveis = useMemo(() => pecas.filter((p) =>
    (quem === "todos" || p.assignee_id === quem)
    && (cliente === "todos" || p.external_client_id === cliente)
    && (p.producao_status !== "entregue" || (p.entregue_em ?? p.updated_at ?? "") >= limite30)),
  [pecas, quem, cliente, limite30]);

  const porEtapa = useMemo(() => {
    const m = new Map<string, PecaExterna[]>();
    for (const c of COLUNAS_ETAPA) m.set(c.etapa, []);
    for (const p of visiveis) {
      const e = p.producao_status ?? "aguardando";
      (m.get(e) ?? m.get("aguardando")!).push(p);
    }
    // Atrasada primeiro, depois o prazo mais perto. Entregue: a mais recente em cima.
    for (const [e, lista] of m) {
      lista.sort(e === "entregue"
        ? (a, b) => (b.entregue_em ?? "").localeCompare(a.entregue_em ?? "")
        : (a, b) => (a.prazo_producao ?? "9999").localeCompare(b.prazo_producao ?? "9999"));
    }
    return m;
  }, [visiveis]);

  const carga = (id: string) => pecas.filter((p) => p.assignee_id === id && p.producao_status !== "entregue").length;

  const cartao = (p: PecaExterna) => {
    const cli = p.external_client_id ? extClients.find((c) => c.id === p.external_client_id) : null;
    const cor = cli?.color || cli?.brand_color || "#9ca3af";
    const d = p.prazo_producao ? diasAte(p.prazo_producao, hoje) : null;
    const entregue = p.producao_status === "entregue";
    const novas = naoLidas.get(p.id) ?? 0;
    const pc = nomeParceiro.get(p.assignee_id);
    return (
      <button key={p.id} type="button" onClick={() => abrirPeca(p)}
        className={cn("w-full text-left rounded-xl border bg-card shadow-sm hover:shadow-md hover:-translate-y-px transition-all overflow-hidden",
          !entregue && d !== null && d < 0 ? "border-red-300" : "border-border", entregue && "opacity-75")}>
        <span className="block h-1" style={{ backgroundColor: cor }} />
        <span className="block p-2.5">
          <span className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-body font-semibold text-muted-foreground truncate flex-1">{cli?.name ?? "Sem cliente"}</span>
            {novas > 0 && (
              <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground" title={`${novas} mensagem(ns) nova(s)`}>
                <MessageCircle className="h-2.5 w-2.5" /> {novas}
              </span>
            )}
          </span>
          <span className="block font-display font-bold text-[13px] leading-snug line-clamp-3">{p.title || "Sem título"}</span>
          <span className="flex items-center gap-1.5 flex-wrap mt-2">
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-violet-700 text-white grid place-items-center text-[9px] font-bold shrink-0"
              title={pc ? `${pc.nome} · ${ROTULO_PAPEL[pc.role] ?? pc.role}` : "Parceiro"}>
              {(pc?.nome ?? "P").charAt(0).toUpperCase()}
            </span>
            <ChipFormato formato={p.format} className="px-1.5" />
            {(p.revisoes ?? 0) > 0 && (
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                (p.revisoes ?? 0) >= 3 ? "bg-red-100 text-red-700" : "bg-violet-100 text-violet-700")}>
                {p.revisoes}ª rev.
              </span>
            )}
            <ChipCache valor={p.cache_parceiro} />
            {p.prazo_status === "negociando" && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">prazo pra responder</span>
            )}
          </span>
          <span className="block mt-1.5">
            {entregue
              ? <span className="text-[11px] font-body text-muted-foreground">entregue {p.entregue_em ? new Date(p.entregue_em).toLocaleDateString("pt-BR") : ""}</span>
              : <ContagemPrazo prazo={p.prazo_producao} hoje={hoje} />}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* Filtros: quem e de qual cliente. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 scrollbar-none flex-1 min-w-0">
          {[{ member_id: "todos", nome: "Todos", role: "" }, ...parceiros].map((pc) => {
            const ativa = pc.member_id === quem;
            const n = pc.member_id === "todos" ? pecas.filter((p) => p.producao_status !== "entregue").length : carga(pc.member_id);
            return (
              <button key={pc.member_id} type="button" onClick={() => setQuem(pc.member_id)}
                className={cn("shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-body font-semibold transition-colors",
                  ativa ? "bg-violet-600 border-violet-600 text-white" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                {pc.member_id === "todos" ? "Todos" : pc.nome.split(" ")[0]}
                <span className={cn("text-[10.5px] font-bold tabular-nums rounded-full px-1.5", ativa ? "bg-white/25" : "bg-muted")}>{n}</span>
              </button>
            );
          })}
        </div>
        {clientesComPeca.length > 1 && (
          <select value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Filtrar por cliente"
            className="h-9 rounded-xl border border-border bg-card px-3 text-[13px] font-body sm:w-56">
            <option value="todos">Todos os clientes</option>
            {clientesComPeca.map((c) => <option key={c.id} value={c.id}>{c.name ?? "Cliente"}</option>)}
          </select>
        )}
      </div>

      {/* Quatro colunas no desktop; no celular vira trilho de lado, 78vw cada. */}
      <div className="flex lg:grid lg:grid-cols-4 gap-3 overflow-x-auto lg:overflow-visible pb-3 -mx-1 px-1 snap-x">
        {COLUNAS_ETAPA.map((col) => {
          const lista = porEtapa.get(col.etapa) ?? [];
          return (
            <div key={col.etapa} className={cn("w-[78vw] max-w-[300px] lg:w-auto lg:max-w-none shrink-0 snap-start rounded-2xl border border-border p-2.5", col.fundo)}>
              <div className="flex items-center gap-2 px-1 mb-2.5">
                <span className={cn("w-2 h-2 rounded-full", col.ponto)} />
                <span className="font-display font-bold text-[13px] flex-1">{col.titulo}</span>
                <span className="text-[10.5px] font-bold tabular-nums rounded-full px-1.5 py-0.5 bg-card border border-border text-muted-foreground">{lista.length}</span>
              </div>
              <div className="space-y-2">
                {lista.length === 0
                  ? <p className="text-[11.5px] font-body text-muted-foreground text-center py-4">nada aqui</p>
                  : lista.map(cartao)}
              </div>
            </div>
          );
        })}
      </div>
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
  // Mensagens novas por peça: o quadro mostra a bolinha em cima do card.
  const { data: conversas = [] } = useConversasComParceiros(parceiros.length > 0);
  const naoLidas = useMemo(() => new Map(conversas.map((c) => [c.post_id, c.nao_lidas ?? 0])), [conversas]);
  /* Agrupar o quadro por ETAPA (padrão, todo mundo junto) ou por CLIENTE (a
     visão de antes, um parceiro por vez, igual ao board do Trello dela). */
  const [agrupar, setAgrupar] = useState<"etapa" | "cliente">(() => {
    try { return localStorage.getItem("cria.parceiros.agrupar") === "cliente" ? "cliente" : "etapa"; } catch { return "etapa"; }
  });
  const trocarAgrupar = (v: "etapa" | "cliente") => { setAgrupar(v); try { localStorage.setItem("cria.parceiros.agrupar", v); } catch { /* sem storage */ } };
  /* Lista ou quadro, lembrado no navegador. O quadro é o jeito que a Gabriela
     já usa no Trello, então é o padrão. */
  type Visao = "quadro" | "lista" | "calendario";
  const [visao, setVisao] = useState<Visao>(() => {
    try {
      const v = localStorage.getItem("cria.parceiros.visao");
      return v === "lista" || v === "calendario" ? v : "quadro";
    } catch { return "quadro"; }
  });
  const trocarVisao = (v: Visao) => { setVisao(v); try { localStorage.setItem("cria.parceiros.visao", v); } catch { /* sem storage */ } };
  /* CLICAR NA PECA ABRE O CARD DO PARCEIRO (Walter, 20/09/2026), a mesma
     janela que o designer ve, com a conversa. "Ir ate o post" dentro dela e o
     que leva pro editor no cliente. */
  const [cardAberto, setCardAberto] = useState<PecaExterna | null>(null);
  /* O AVISO DO SINO ABRE A PEÇA (28/09/2026): "sugeriu outro prazo" e peça sem
     cliente no CRM chegam aqui com ?post=. Abre o card uma vez e limpa a URL,
     senão fechar o card e dar F5 abriria de novo. */
  const [params, setParams] = useSearchParams();
  const postDaUrl = params.get("post");
  useEffect(() => {
    if (!postDaUrl || isLoading) return;
    const p = pecas.find((x) => x.id === postDaUrl);
    /* Fora da lista (ela vem com teto de 300): abre mesmo assim. O card busca
       tudo pelo id; só o nome do parceiro fica em branco no cabeçalho. */
    setCardAberto(p ?? ({ id: postDaUrl, assignee_id: "", external_client_id: null } as unknown as PecaExterna));
    const n = new URLSearchParams(params); n.delete("post"); setParams(n, { replace: true });
  }, [postDaUrl, pecas, isLoading, params, setParams]);
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
  const irAoPost = (p: PecaExterna) => {
    const ec = p.external_client_id ? extClients.find((c) => c.id === p.external_client_id) : null;
    if (ec?.crm_client_id) navigate(`/socialmidia/clientes/${ec.crm_client_id}/posts?post=${p.id}`);
    else navigate("/socialmidia/criapost"); // sem cliente no CRM: o quadro geral, nunca clique morto
  };
  const abrirPeca = (p: PecaExterna) => setCardAberto(p);

  const linhaPeca = (p: PecaExterna, extra?: React.ReactNode) => (
    <button key={p.id} type="button" onClick={() => abrirPeca(p)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors">
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold text-[14px] leading-tight truncate">{p.title || "Sem título"}</span>
        <span className="flex items-center gap-2 mt-1 flex-wrap">
          {p.external_client_id && clientes[p.external_client_id] && (
            <span className="text-[11.5px] font-body font-semibold text-foreground/85">{clientes[p.external_client_id]}</span>
          )}
          <ChipFormato formato={p.format} />
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
                {/* Linha + ações (Walter, 29/09/2026: "não tem onde eu dar
                    check que tá ok ou pedir ajuste"). As ações ficam FORA do
                    botão da linha: botão dentro de botão é HTML inválido e o
                    clique vazava pra abrir o card. */}
                {praRevisar.map((p) => (
                  <div key={p.id}>
                    {linhaPeca(p,
                      <span className="text-[11px] font-bold text-green-700 bg-green-100 rounded-full px-2.5 py-1">
                        {/* entregue_em é gravado na transição de status. `updated_at`
                            mudava a cada edição e mostrava a data errada aqui. */}
                        entregue {p.entregue_em ? new Date(p.entregue_em).toLocaleDateString("pt-BR") : ""}
                      </span>)}
                    <div className="px-4 pb-3 -mt-1">
                      <AcoesDeRevisao postId={p.id} nomeParceiro={nomeParceiro.get(p.assignee_id)?.nome} compacto />
                    </div>
                  </div>
                ))}
              </Card>
              <p className="text-[11px] font-body text-muted-foreground mt-1.5 px-0.5">
                Abra a peça pra ver o material. <b>Tá ok</b> manda pra "Aguardando cliente"; <b>Pedir ajuste</b> devolve pro parceiro com o motivo.
              </p>
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
                Clique na peça e preencha o "Cachê desta peça" no card: salva só o valor, sem mexer na entrega nem no prazo.
              </p>
            </section>
          )}

          {/* ── 3. NA MÃO DE CADA PARCEIRO: quadro por cliente ou lista ── */}
          <section>
            <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Produção com parceiros
              </p>
              <div className="inline-flex rounded-full border border-border bg-card p-0.5">
                {([["quadro", KanbanSquare, "Quadro"], ["lista", List, "Lista"], ["calendario", CalendarDays, "Calendário"]] as const).map(([v, Icone, rotulo]) => (
                  <button key={v} type="button" onClick={() => trocarVisao(v)}
                    className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-body font-semibold transition-colors",
                      visao === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    <Icone className="h-3.5 w-3.5" /> {rotulo}
                  </button>
                ))}
              </div>
            </div>

            {visao === "calendario" ? (
              /* O calendario geral, ja no modo Com parceiros e sem o botao de
                 sair dele: entrega e postagem de cada peca, por parceiro. */
              <ManagerCalendar somenteParceiros compacto />
            ) : visao === "quadro" ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-[12px] font-body">
                  <span className="text-muted-foreground">Agrupar por</span>
                  {(["etapa", "cliente"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => trocarAgrupar(v)}
                      className={cn("rounded-full px-2.5 py-0.5 font-semibold border transition-colors",
                        agrupar === v ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                      {v === "etapa" ? "etapa" : "cliente (um parceiro por vez)"}
                    </button>
                  ))}
                </div>
                {agrupar === "etapa" ? (
                  <QuadroDeProducao
                    parceiros={parceiros}
                    pecas={pecas}
                    extClients={extClients as ExternalClient[]}
                    hoje={hoje}
                    abrirPeca={abrirPeca}
                    nomeParceiro={nomeParceiro}
                    naoLidas={naoLidas}
                  />
                ) : (
                  <QuadroDoParceiro
                    parceiros={parceiros}
                    pecas={pecas}
                    extClients={extClients as ExternalClient[]}
                    hoje={hoje}
                    abrirPeca={abrirPeca}
                    nomeParceiro={nomeParceiro}
                  />
                )}
              </div>
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
            <Send className="h-3 w-3" /> Clique numa peça pra abrir o card que o parceiro vê, com a conversa.
            Dentro dele, "Ir até o post" leva pro editor.
          </p>

          <CardAbertoDialog
            postId={cardAberto?.id ?? null}
            aoFechar={() => setCardAberto(null)}
            agencia={cardAberto ? {
              nomeDoParceiro: nomeParceiro.get(cardAberto.assignee_id)?.nome ?? null,
              crmClientId: cardAberto.external_client_id
                ? (extClients.find((c) => c.id === cardAberto.external_client_id)?.crm_client_id ?? null)
                : null,
              irAoPost: () => { const p = cardAberto; setCardAberto(null); irAoPost(p); },
            } : undefined}
          />
        </>
      )}
    </div>
  );
}

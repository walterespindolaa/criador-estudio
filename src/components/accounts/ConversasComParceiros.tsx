import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ExternalLink, Loader2, MessageCircle, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatDoCard, CardAbertoDialog } from "@/pages/app/MinhasDemandas";
import { useExternalClients, type ExternalClient } from "@/hooks/useCriaPost";
import {
  ROTULO_PAPEL, useConversaDoCard, useConversasComParceiros, useMarcarConversaLida,
  useMeusParceiros, usePecasComParceiros, type ConversaResumo,
} from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   CONVERSAS COM PARCEIROS (Walter, 28/09/2026)

   "Tem que ter um campo único de visualização da conversa entre a social
   media e os prestadores de serviço." Antes, cada conversa morava dentro do
   card dela: pra saber se a designer respondeu, a Gabriela abria peça por
   peça, e o que chegava de madrugada virava WhatsApp.

   É uma caixa de entrada no formato que todo mundo já sabe usar: a lista de
   conversas à esquerda (a mais recente em cima, com bolinha de não lida) e a
   conversa aberta à direita. No celular, uma coisa de cada vez: lista, toca,
   conversa, volta.

   Cada conversa continua sendo a do CARD (mesma tabela, mesmo histórico): o
   que ela escreve aqui aparece dentro do card pro parceiro, e vice-versa.
   Não existe um segundo chat pra ficar fora de sincronia.
   ═══════════════════════════════════════════════════════════════════════════ */

const FORMATO: Record<string, string> = {
  reels: "Reels", carrossel: "Carrossel", foto: "Estático", story: "Story",
  video: "Vídeo", shorts: "Shorts", live: "Live",
};
const ETAPA: Record<string, { txt: string; cls: string }> = {
  aguardando: { txt: "Novo", cls: "bg-orange-100 text-orange-700" },
  em_producao: { txt: "Fazendo", cls: "bg-blue-100 text-blue-700" },
  ajuste: { txt: "Em ajuste", cls: "bg-violet-100 text-violet-700" },
  entregue: { txt: "Entregue", cls: "bg-green-100 text-green-700" },
};

/** "agora", "12 min", "14:32", "ontem", "23/09": o jeito de hora de app de mensagem. */
function quando(iso: string): string {
  const d = new Date(iso);
  const agora = new Date();
  const min = Math.round((agora.getTime() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const mesmoDia = d.toDateString() === agora.toDateString();
  if (mesmoDia) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const ontem = new Date(agora); ontem.setDate(agora.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** A prévia da última fala: link de imagem vira "imagem", o resto em uma linha. */
function previa(texto: string): string {
  const semUrl = texto.replace(/https?:\/\/\S+\.(png|jpe?g|gif|webp|avif|svg)(\?\S*)?/gi, "[imagem]")
    .replace(/https?:\/\/\S+/g, "[link]");
  return semUrl.replace(/\s+/g, " ").trim() || "[anexo]";
}

type Fio = {
  post_id: string;
  titulo: string | null;
  formato: string | null;
  external_client_id: string | null;
  assignee_id: string;
  producao_status: string;
};

/* ── A conversa aberta ─────────────────────────────────────────────────────
   Isolada num componente pra que a query e o carimbo de leitura existam só
   pra conversa que está na tela. */
function ConversaAberta({ fio, cliente, parceiro, aoVoltar, aoAbrirCard }: {
  fio: Fio;
  cliente: ExternalClient | null;
  parceiro: { nome: string; role: string } | null;
  aoVoltar: () => void;
  aoAbrirCard: () => void;
}) {
  const conversa = useConversaDoCard(fio.post_id);
  const marcarLida = useMarcarConversaLida();
  const [texto, setTexto] = useState("");
  const cor = cliente?.color || cliente?.brand_color || "#4B3FA8";

  // Leu = abriu. Refaz quando chega fala nova com a conversa na tela.
  const qtd = conversa.mensagens.length;
  useEffect(() => {
    marcarLida.mutate(fio.post_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fio.post_id, qtd]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    await conversa.enviar.mutateAsync(t);
    setTexto("");
  };

  const etapa = ETAPA[fio.producao_status];

  return (
    <ChatDoCard
      className="bg-card flex flex-col min-h-0 h-full"
      cor={cor}
      mensagens={conversa.mensagens.map((m) => ({ id: m.id, texto: m.content, papel: m.author_role, em: m.created_at }))}
      texto={texto}
      setTexto={setTexto}
      enviar={enviar}
      enviando={conversa.enviar.isPending}
      anexando={conversa.mandarImagem.isPending}
      aoMandarImagem={(arquivo) => conversa.mandarImagem.mutate({ arquivo, legenda: texto.trim() || undefined }, { onSuccess: () => setTexto("") })}
      aoLimparTexto={() => setTexto("")}
      rodape="Enter manda. O parceiro recebe o aviso e vê a mesma conversa dentro do card."
      quem={{ meuPapel: "social_media", nomeParceiro: parceiro?.nome ?? null }}
      titulo={
        <div className="shrink-0 flex items-center gap-2.5 px-3 sm:px-4 py-3 border-b border-border">
          <button type="button" onClick={aoVoltar} aria-label="Voltar pra lista"
            className="lg:hidden grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-muted text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="w-9 h-9 rounded-full shrink-0 grid place-items-center text-white text-[12px] font-bold"
            style={{ backgroundColor: cor }}>
            {(parceiro?.nome ?? "P").charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-bold text-[14px] leading-tight truncate">{fio.titulo || "Sem título"}</span>
            <span className="flex items-center gap-1.5 mt-0.5 text-[11.5px] font-body text-muted-foreground min-w-0">
              <span className="truncate">
                {parceiro?.nome.split(" ")[0] ?? "Parceiro"}
                {parceiro ? ` · ${ROTULO_PAPEL[parceiro.role] ?? parceiro.role}` : ""}
                {cliente?.name ? ` · ${cliente.name}` : ""}
              </span>
              {etapa && <span className={cn("shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full", etapa.cls)}>{etapa.txt}</span>}
            </span>
          </span>
          <Button size="sm" variant="outline" className="rounded-xl shrink-0 h-9" onClick={aoAbrirCard}>
            <ExternalLink className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Abrir card</span>
          </Button>
        </div>
      }
    />
  );
}

export function ConversasComParceiros() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: parceiros = [] } = useMeusParceiros();
  const { data: conversas = [], isLoading } = useConversasComParceiros(parceiros.length > 0);
  const { data: pecas = [] } = usePecasComParceiros(parceiros.length > 0);
  const { clients } = useExternalClients();
  const [busca, setBusca] = useState("");
  const [soDe, setSoDe] = useState<string>("todos");
  const [cardAberto, setCardAberto] = useState<string | null>(null);
  const [comecando, setComecando] = useState(false);

  const extClients = clients as ExternalClient[];
  const clienteDe = (id: string | null) => (id ? extClients.find((c) => c.id === id) ?? null : null);
  const parceiroDe = useMemo(() => {
    const m = new Map<string, { nome: string; role: string }>();
    for (const p of parceiros) m.set(p.member_id, { nome: p.nome, role: p.role });
    return m;
  }, [parceiros]);

  // A conversa aberta mora na URL (?post=): o aviso do sino cai direto nela
  // e o "voltar" do navegador fecha a conversa em vez de sair da Equipe.
  const selecionado = params.get("post");
  const abrir = (postId: string | null) => {
    const n = new URLSearchParams(params);
    if (postId) n.set("post", postId); else n.delete("post");
    setParams(n, { replace: false });
  };

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return conversas.filter((c) => {
      if (soDe !== "todos" && c.assignee_id !== soDe) return false;
      if (!q) return true;
      const cli = clienteDe(c.external_client_id)?.name ?? "";
      const quem = parceiroDe.get(c.assignee_id)?.nome ?? "";
      return [c.titulo ?? "", cli, quem, c.ultima_texto].some((t) => t.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas, busca, soDe, parceiroDe, extClients]);

  /* Aviso do sino apontando pra um card fora das duas listas (elas têm teto):
     busca só aquele post, pra conversa abrir em vez de um painel vazio. */
  const foraDasListas = !!selecionado && !isLoading
    && !conversas.some((x) => x.post_id === selecionado) && !pecas.some((x) => x.id === selecionado);
  const { data: postAvulso } = useQuery({
    queryKey: ["conversa-post-avulso", selecionado],
    enabled: foraDasListas,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("posts")
        .select("id, title, format, external_client_id, assignee_id, producao_status")
        .eq("id", selecionado).maybeSingle();
      return (data as { id: string; title: string | null; format: string | null; external_client_id: string | null; assignee_id: string | null; producao_status: string | null } | null) ?? null;
    },
  });

  /* O fio aberto pode ser um card SEM conversa ainda (veio do "Começar
     conversa" ou do link de um aviso): aí os dados vêm da lista de peças. */
  const fioAberto: Fio | null = useMemo(() => {
    if (!selecionado) return null;
    const c = conversas.find((x) => x.post_id === selecionado);
    if (c) return c;
    const p = pecas.find((x) => x.id === selecionado);
    if (!p) {
      if (!postAvulso?.assignee_id) return null;
      return {
        post_id: postAvulso.id, titulo: postAvulso.title, formato: postAvulso.format,
        external_client_id: postAvulso.external_client_id, assignee_id: postAvulso.assignee_id,
        producao_status: postAvulso.producao_status ?? "aguardando",
      };
    }
    return {
      post_id: p.id, titulo: p.title, formato: p.format, external_client_id: p.external_client_id,
      assignee_id: p.assignee_id, producao_status: p.producao_status ?? "aguardando",
    };
  }, [selecionado, conversas, pecas, postAvulso]);

  // Peças abertas que ainda não têm conversa: é daqui que nasce uma nova.
  const semConversa = useMemo(() => {
    const comFio = new Set(conversas.map((c) => c.post_id));
    return pecas.filter((p) => !comFio.has(p.id) && p.producao_status !== "entregue");
  }, [conversas, pecas]);

  const totalNaoLidas = conversas.reduce((s, c) => s + (c.nao_lidas ?? 0), 0);

  if (parceiros.length === 0) {
    return (
      <Card className="p-10 rounded-2xl border-dashed text-center">
        <MessageCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2.5" />
        <p className="text-sm font-body font-medium text-foreground">Nenhum parceiro na equipe ainda</p>
        <p className="text-xs text-muted-foreground font-body mt-1 max-w-md mx-auto">
          Convide um designer, editor ou filmmaker na aba Pessoas. As conversas de cada peça com eles aparecem aqui, num lugar só.
        </p>
      </Card>
    );
  }

  const linha = (c: ConversaResumo) => {
    const cli = clienteDe(c.external_client_id);
    const quem = parceiroDe.get(c.assignee_id);
    const ativa = c.post_id === selecionado;
    const minha = c.ultima_papel === "social_media";
    const novas = c.nao_lidas ?? 0;
    return (
      <button key={c.post_id} type="button" onClick={() => abrir(c.post_id)}
        className={cn("w-full flex items-start gap-2.5 px-3 py-3 text-left transition-colors border-l-[3px]",
          ativa ? "bg-primary/[0.06] border-l-primary" : "border-l-transparent hover:bg-muted/50")}>
        <span className="relative w-9 h-9 rounded-full shrink-0 grid place-items-center text-white text-[12px] font-bold"
          style={{ backgroundColor: cli?.color || cli?.brand_color || "#7C90F0" }}>
          {(quem?.nome ?? "P").charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn("flex-1 min-w-0 truncate font-display text-[13.5px] leading-tight", novas > 0 ? "font-extrabold" : "font-bold")}>
              {c.titulo || "Sem título"}
            </span>
            <span className={cn("shrink-0 text-[11px] font-body", novas > 0 ? "text-primary font-bold" : "text-muted-foreground")}>
              {quando(c.ultima_em)}
            </span>
          </span>
          <span className="block text-[11.5px] font-body text-muted-foreground truncate mt-0.5">
            {quem?.nome.split(" ")[0] ?? "Parceiro"}{cli?.name ? ` · ${cli.name}` : ""}{c.formato ? ` · ${FORMATO[c.formato] ?? c.formato}` : ""}
          </span>
          <span className="flex items-center gap-2 mt-1">
            <span className={cn("flex-1 min-w-0 truncate text-[12.5px] font-body", novas > 0 ? "text-foreground font-semibold" : "text-muted-foreground")}>
              {minha ? "Você: " : ""}{previa(c.ultima_texto)}
            </span>
            {novas > 0 && (
              <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold grid place-items-center tabular-nums">
                {novas}
              </span>
            )}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card overflow-hidden grid lg:grid-cols-[340px_minmax(0,1fr)] h-[calc(100dvh-230px)] min-h-[520px]">
        {/* ── A LISTA ── (no celular some quando uma conversa está aberta) */}
        <div className={cn("flex flex-col min-h-0 lg:border-r border-border", fioAberto && "max-lg:hidden")}>
          <div className="shrink-0 p-3 space-y-2 border-b border-border">
            <div className="flex items-center gap-2">
              <p className="flex-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Conversas{totalNaoLidas > 0 && <span className="ml-1.5 normal-case tracking-normal text-primary">{totalNaoLidas} nova{totalNaoLidas === 1 ? "" : "s"}</span>}
              </p>
              {semConversa.length > 0 && (
                <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => setComecando((v) => !v)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Nova
                </Button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar peça, cliente ou parceiro"
                className="w-full h-9 rounded-xl border border-border bg-background pl-8 pr-3 text-[13px] font-body" />
            </div>
            {parceiros.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 scrollbar-none">
                {[{ member_id: "todos", nome: "Todos" }, ...parceiros].map((p) => (
                  <button key={p.member_id} type="button" onClick={() => setSoDe(p.member_id)}
                    className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-body font-semibold transition-colors",
                      soDe === p.member_id ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                    {p.member_id === "todos" ? "Todos" : p.nome.split(" ")[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Começar conversa sobre uma peça que ainda não tem fala. */}
          {comecando && (
            <div className="shrink-0 border-b border-border bg-muted/30 max-h-56 overflow-y-auto">
              <p className="px-3 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Começar sobre qual peça?</p>
              {semConversa.map((p) => (
                <button key={p.id} type="button" onClick={() => { setComecando(false); abrir(p.id); }}
                  className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors">
                  <span className="block text-[13px] font-body font-semibold truncate">{p.title || "Sem título"}</span>
                  <span className="block text-[11.5px] font-body text-muted-foreground truncate">
                    {parceiroDe.get(p.assignee_id)?.nome.split(" ")[0] ?? "Parceiro"}{clienteDe(p.external_client_id)?.name ? ` · ${clienteDe(p.external_client_id)?.name}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/60">
            {isLoading ? (
              <div className="grid place-items-center py-14"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filtradas.length === 0 ? (
              <p className="text-[12.5px] font-body text-muted-foreground text-center px-6 py-12 leading-relaxed">
                {conversas.length === 0
                  ? "Nenhuma conversa ainda. Quando você ou um parceiro escrever no card de uma peça, a conversa aparece aqui."
                  : "Nada com esse filtro."}
              </p>
            ) : filtradas.map(linha)}
          </div>
        </div>

        {/* ── A CONVERSA ── */}
        <div className={cn("min-h-0 flex flex-col", !fioAberto && "max-lg:hidden")}>
          {fioAberto ? (
            <ConversaAberta
              key={fioAberto.post_id}
              fio={fioAberto}
              cliente={clienteDe(fioAberto.external_client_id)}
              parceiro={parceiroDe.get(fioAberto.assignee_id) ?? null}
              aoVoltar={() => abrir(null)}
              aoAbrirCard={() => setCardAberto(fioAberto.post_id)}
            />
          ) : (
            <div className="flex-1 grid place-items-center p-8 text-center">
              <div>
                <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/60 mb-3" />
                <p className="text-sm font-body font-semibold text-foreground">Escolha uma conversa</p>
                <p className="text-xs font-body text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
                  Todas as conversas com designers, editores e filmmakers ficam aqui. É a mesma conversa de dentro do card:
                  o que você escreve aqui, o parceiro vê lá.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CardAbertoDialog
        postId={cardAberto}
        aoFechar={() => setCardAberto(null)}
        agencia={cardAberto ? (() => {
          const p = pecas.find((x) => x.id === cardAberto);
          const f = fioAberto;
          const ecId = p?.external_client_id ?? f?.external_client_id ?? null;
          const assignee = p?.assignee_id ?? f?.assignee_id ?? "";
          return {
            nomeDoParceiro: parceiroDe.get(assignee)?.nome ?? null,
            crmClientId: clienteDe(ecId)?.crm_client_id ?? null,
            irAoPost: () => {
              const crm = clienteDe(ecId)?.crm_client_id;
              const id = cardAberto;
              setCardAberto(null);
              navigate(crm ? `/socialmidia/clientes/${crm}/posts?post=${id}` : "/socialmidia/equipe/producao");
            },
          };
        })() : undefined}
      />
    </div>
  );
}

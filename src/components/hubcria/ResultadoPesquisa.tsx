import { useState } from "react";
import {
  Loader2, Sparkles, Check, X, Trash2, Instagram, Heart, MessageCircle, Play, CalendarPlus,
  FileText, ChevronDown, ExternalLink, MoreHorizontal, ArrowRightLeft, Copy, RefreshCw, Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CRIA_HEX } from "@/lib/moduleTheme";
import { confirmar } from "@/components/shared/Confirm";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CreativeIdea } from "@/hooks/useHubCria";

/* ═══════════════════════════════════════════════════════════════════════════
   A ENTREGA DA PESQUISA

   Este arquivo é só o RESULTADO: o que a pessoa lê depois que a leitura
   terminou. Ele saiu de dentro do CriativoTab porque três telas diferentes
   mostram o mesmo resultado (o módulo, a aba Concorrência da ficha e o
   histórico geral) e nenhuma delas deveria carregar o formulário junto.

   O princípio continua o mesmo: a tela não despeja número, ela entrega
   CONCLUSÃO. E agora entrega também SAÍDA: qualquer post, anúncio ou
   comentário aqui dentro vira pauta do cliente em um clique.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Cor da faixa lateral: a pessoa aprende a cor e reconhece o tipo sem ler. */
export const COR_DO_TIPO: Record<string, string> = {
  posts: CRIA_HEX.laranja, reels: CRIA_HEX.laranja, profile: "#D9D5CC",
  transcription: CRIA_HEX.lilas,
  ads: CRIA_HEX.verde, comments: CRIA_HEX.azul, hashtag: CRIA_HEX.azul, mentions: CRIA_HEX.azul,
};

export function haQuanto(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  const m = Math.floor(d / 30);
  return m === 1 ? "há 1 mês" : `há ${m} meses`;
}

export function fmtNum(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace(".0", "") + "M";
  if (v >= 1000) return (v / 1000).toFixed(1).replace(".0", "") + "k";
  return String(v);
}

const STATUS_META: Record<CreativeIdea["status"], { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-muted text-muted-foreground" },
  usar: { label: "Usar", cls: "bg-primary/10 text-primary" },
  usada: { label: "Usada", cls: "bg-secondary/15 text-secondary" },
  descartada: { label: "Descartada", cls: "bg-destructive/10 text-destructive" },
};

/**
 * O resultado do Apify é JSON livre: cada tipo de pesquisa devolve chaves
 * diferentes (o perfil tem "followers", o anúncio tem "cta", o reel tem
 * "transcript"). Tipar cada shape aqui seria mentira: quem garante o formato é
 * o summarize() da edge. Um alias único e honesto, em vez de `any` espalhado.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bruto = Record<string, any>;

/** O que uma referência vira quando a pessoa clica em "virar pauta". */
export type Referencia = {
  title: string;
  rationale?: string | null;
  ref_url?: string | null;
  format?: string | null;
};

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="text-lg font-display font-extrabold text-foreground">{value}</p>
      <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

function IdeaBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-body border transition-colors", active ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
      {icon}{children}
    </button>
  );
}

export function IdeaCard({ idea, onStatus, onDelete }: { idea: CreativeIdea; onStatus: (id: string, status: CreativeIdea["status"]) => void; onDelete: (id: string) => void }) {
  const sm = STATUS_META[idea.status];
  return (
    <div className="bg-card border border-border rounded-xl p-3.5 flex flex-col">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {idea.format && <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{idea.format}</span>}
            <span className={cn("text-[10px] font-body px-1.5 py-0.5 rounded-full", sm.cls)}>{sm.label}</span>
          </div>
          <p className="text-sm font-body font-semibold text-foreground leading-snug">{idea.title}</p>
          {idea.rationale && <p className="text-[12px] font-body text-muted-foreground mt-1 leading-relaxed">{idea.rationale}</p>}
          {idea.ref_url && (
            <a href={idea.ref_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-body font-semibold text-primary hover:underline mt-1.5">
              <ExternalLink className="h-3 w-3" /> ver a referência
            </a>
          )}
        </div>
        <button onClick={() => onDelete(idea.id)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-border/60">
        <IdeaBtn active={idea.status === "usar"} onClick={() => onStatus(idea.id, "usar")} icon={<Check className="h-3 w-3" />}>Usar</IdeaBtn>
        <IdeaBtn active={idea.status === "usada"} onClick={() => onStatus(idea.id, "usada")}>Usada</IdeaBtn>
        <IdeaBtn active={idea.status === "descartada"} onClick={() => onStatus(idea.id, "descartada")} icon={<X className="h-3 w-3" />}>Descartar</IdeaBtn>
      </div>
    </div>
  );
}

/** Botãozinho que transforma o que está na tela em pauta do cliente. */
function BotaoReferencia({ onClick, rotulo = "virar pauta" }: { onClick: () => void; rotulo?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-display font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
    >
      <Lightbulb className="h-3 w-3" /> {rotulo}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TOP POST, antes era uma linha de texto cortada, sem capa e sem link.
// A pessoa lia "média de curtidas: 0" e fechava a tela. O dado do post
// (capa, link, transcrição) já vinha do Apify, a tela é que jogava fora.
// ═══════════════════════════════════════════════════════════════════════
function TopPostCard({ p, rank, aoUsarReferencia }: { p: Bruto; rank: number; aoUsarReferencia?: (r: Referencia) => void }) {
  const [aberto, setAberto] = useState(false);
  const legenda = String(p.caption || "");
  const transcricao = String(p.transcript || "");
  const longo = legenda.length > 160 || transcricao.length > 200;

  const virarPauta = () => {
    if (!aoUsarReferencia) return;
    // O título da pauta é a primeira linha útil da legenda (ou o resumo da IA,
    // que é melhor ainda quando existe). Legenda inteira num título vira lixo.
    const base = String(p.resumo || legenda || "").replace(/\s+/g, " ").trim();
    aoUsarReferencia({
      title: base.slice(0, 160) || "Referência salva do Cria Radar",
      rationale: transcricao
        ? `Roteiro da referência:\n${transcricao.slice(0, 900)}`
        : legenda.slice(0, 900) || null,
      ref_url: p.url || null,
      format: /clips|video|reel/i.test(String(p.format || "")) ? "reels"
        : /sidecar|carousel/i.test(String(p.format || "")) ? "carrossel" : null,
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex gap-3 p-3">
        {/* Capa. Clicou, abre o post no Instagram. */}
        {p.url ? (
          <a href={p.url} target="_blank" rel="noopener noreferrer"
            className="group relative h-24 w-24 shrink-0 rounded-lg overflow-hidden border border-border bg-muted grid place-items-center">
            {p.thumbnail
              ? <img src={p.thumbnail} referrerPolicy="no-referrer" alt="" loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
              : <Instagram className="h-5 w-5 text-muted-foreground/40" />}
            <span className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors grid place-items-center">
              <ExternalLink className="h-4 w-4 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
            </span>
          </a>
        ) : (
          <div className="h-24 w-24 shrink-0 rounded-lg border border-border bg-muted grid place-items-center">
            {p.thumbnail
              ? <img src={p.thumbnail} referrerPolicy="no-referrer" alt="" loading="lazy" className="h-full w-full object-cover rounded-lg" />
              : <Instagram className="h-5 w-5 text-muted-foreground/40" />}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-[10px] font-body font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">#{rank}</span>
            {p.format && <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0">{p.format}</span>}
            <span className="flex items-center gap-0.5 text-[11px] font-body text-muted-foreground"><Heart className="h-3 w-3" />{fmtNum(p.likes)}</span>
            <span className="flex items-center gap-0.5 text-[11px] font-body text-muted-foreground"><MessageCircle className="h-3 w-3" />{fmtNum(p.comments)}</span>
            {p.views != null && <span className="flex items-center gap-0.5 text-[11px] font-body text-muted-foreground"><Play className="h-3 w-3" />{fmtNum(p.views)}</span>}
          </div>

          <p className={cn("text-[12.5px] font-body text-foreground leading-snug whitespace-pre-wrap", !aberto && "line-clamp-3")}>
            {legenda || "(sem legenda)"}
          </p>

          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-body font-semibold text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> ver o post
              </a>
            )}
            {aoUsarReferencia && <BotaoReferencia onClick={virarPauta} />}
          </div>
        </div>
      </div>

      {/* O RESUMO DA IA: em uma frase, do que é o reel. É o que faz a pessoa
          decidir se vale ler o roteiro inteiro ou pular pro próximo. */}
      {p.resumo && (
        <div className="border-t border-border/60 px-3 py-2" style={{ background: `${CRIA_HEX.lilas}0d` }}>
          <p className="text-[12px] font-body text-foreground leading-relaxed">
            <strong className="font-display">Em uma frase:</strong> {p.resumo}
          </p>
        </div>
      )}

      {/* A ENGENHARIA REVERSA: a IA decompõe o roteiro em gancho, estrutura,
          CTA e a adaptação pro cliente. É o direcionamento pronto, não só o
          texto cru pra pessoa analisar sozinha. */}
      {p.engenharia && (p.engenharia.gancho || p.engenharia.estrutura?.length > 0) && (
        <div className="border-t border-border/60 px-3 py-2.5 space-y-2" style={{ background: `${CRIA_HEX.amarelo}14` }}>
          <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Engenharia reversa
          </p>
          {p.engenharia.gancho && (
            <p className="text-[12px] font-body text-foreground leading-relaxed">
              <strong className="font-display">Gancho:</strong> {p.engenharia.gancho}
            </p>
          )}
          {Array.isArray(p.engenharia.estrutura) && p.engenharia.estrutura.length > 0 && (
            <div>
              <p className="text-[11px] font-body font-bold text-foreground mb-0.5">Estrutura do roteiro</p>
              <ol className="space-y-0.5">
                {p.engenharia.estrutura.map((e: string, i: number) => (
                  <li key={i} className="text-[12px] font-body text-foreground/90 leading-relaxed flex gap-1.5">
                    <span className="font-display font-bold text-primary shrink-0">{i + 1}.</span> {e}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {p.engenharia.cta && (
            <p className="text-[12px] font-body text-foreground leading-relaxed">
              <strong className="font-display">CTA:</strong> {p.engenharia.cta}
            </p>
          )}
          {p.engenharia.porque && (
            <p className="text-[12px] font-body text-foreground/90 leading-relaxed">
              <strong className="font-display">Por que funciona:</strong> {p.engenharia.porque}
            </p>
          )}
          {p.engenharia.adaptacao && (
            <p className="text-[12px] font-body text-foreground leading-relaxed rounded-lg bg-card border border-border/60 px-2.5 py-1.5">
              <strong className="font-display">Como usar no seu cliente:</strong> {p.engenharia.adaptacao}
            </p>
          )}
        </div>
      )}

      {/* A TRANSCRIÇÃO, é o roteiro do concorrente. É o produto desta análise. */}
      {transcricao && (
        <div className="border-t border-border/60 bg-muted/30 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> Roteiro (áudio transcrito)
            </p>
            <button
              onClick={() => { void navigator.clipboard.writeText(transcricao); toast.success("Roteiro copiado."); }}
              className="text-[10px] font-body font-bold text-primary hover:underline shrink-0"
            >
              copiar roteiro
            </button>
          </div>
          <p className={cn("text-[12.5px] font-body text-foreground/90 leading-relaxed whitespace-pre-wrap", !aberto && "line-clamp-4")}>
            {transcricao}
          </p>
        </div>
      )}

      {longo && (
        <button onClick={() => setAberto((a) => !a)}
          className="w-full py-2 text-[11px] font-body font-semibold text-primary hover:bg-muted/40 border-t border-border/60 transition-colors">
          {aberto ? "mostrar menos" : "ler tudo"}
        </button>
      )}
    </div>
  );
}

/**
 * A LEITURA DA ANÁLISE.
 *
 * O erro do que existia: a tela DESPEJAVA o dado (contagem, média, lista) e
 * deixava a pessoa fazer a interpretação sozinha. Mas ela não paga pra ver
 * número: paga pra ter a CONCLUSÃO. Aqui a gente lê os dados e escreve a frase
 * que ela repetiria na reunião com o cliente.
 */
function lerAnalise(s: Bruto): string | null {
  const kind = s.kind;
  const fmts: Record<string, number> = s.formats || {};
  const total = Number(s.count) || 0;

  if (kind === "comments") {
    return total > 0
      ? `Foram ${total} comentários lidos. As dúvidas que se repetem viraram pauta aqui embaixo: é o público dizendo o que quer ouvir.`
      : null;
  }
  if (kind === "ads") {
    return total > 0
      ? `Ele mantém ${total} ${total === 1 ? "anúncio ativo" : "anúncios ativos"}. Isso é dinheiro dele apostando: a oferta e o ângulo abaixo já foram testados e ele decidiu pagar pra repetir.`
      : null;
  }
  if (kind === "profile") return null;

  if (!total) return null;

  const partes: string[] = [];
  const dominante = Object.entries(fmts).sort((a, b) => b[1] - a[1])[0];
  if (dominante && total > 2) {
    const nome = /clips|video/i.test(dominante[0]) ? "Reels"
      : /sidecar|carousel/i.test(dominante[0]) ? "carrossel"
      : /image|graph/i.test(dominante[0]) ? "foto" : dominante[0];
    partes.push(`o formato que ele mais usa é ${nome} (${dominante[1]} de ${total})`);
  }
  if (s.avg_likes) partes.push(`a média é de ${fmtNum(s.avg_likes)} curtidas por post`);
  if (s.avg_views) partes.push(`${fmtNum(s.avg_views)} views por vídeo`);

  if (kind === "transcription") {
    return `Os roteiros abaixo são o áudio transcrito dos reels que mais rodaram${partes.length ? `: ${partes[0]}` : ""}. Leia o gancho dos primeiros segundos: é ali que a retenção é ganha ou perdida.`;
  }
  return partes.length ? `Lendo ${total} publicações: ${partes.join(", ")}.` : null;
}

export const KIND_LABEL: Record<string, string> = {
  profile: "Raio-x do perfil", comments: "As dúvidas do público", ads: "Onde ele aposta dinheiro",
  posts: "O que ele posta", reels: "Os reels dele", hashtag: "A hashtag do nicho",
  mentions: "Quem fala dele", transcription: "O roteiro do reel que bombou",
};

export function SummaryCard({
  summary, handle, quando, custo, defaultOpen = false, onDelete, ideas, onIdeaStatus, onIdeaDelete,
  aoCriarPosts, criandoPosts,
  clienteNome, clientes, aoMover, aoDuplicar, aoRodarDeNovo, aoUsarReferencia,
}: {
  summary: Record<string, unknown>; handle: string;
  quando?: string; custo?: number | null;
  defaultOpen?: boolean; onDelete?: () => void;
  ideas?: CreativeIdea[];
  onIdeaStatus?: (id: string, status: CreativeIdea["status"]) => void;
  onIdeaDelete?: (id: string) => void;
  aoCriarPosts?: () => void; criandoPosts?: boolean;
  /** Nome do cliente dono da pesquisa (usado no histórico geral). */
  clienteNome?: string | null;
  /** Carteira, pra mover ou copiar a pesquisa pra outro cliente. */
  clientes?: { id: string; nome: string }[];
  aoMover?: (paraClienteId: string | null) => void;
  aoDuplicar?: (paraClienteId: string | null) => void;
  aoRodarDeNovo?: () => void;
  aoUsarReferencia?: (r: Referencia) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const s = summary as Bruto;
  const kind = s.kind;
  const count = typeof s.count === "number" ? s.count : (Array.isArray(s.top) ? s.top.length : null);
  const shortHandle = handle.length > 40 ? handle.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").slice(0, 30) + "…" : handle;
  const leitura = lerAnalise(s);
  const hex = COR_DO_TIPO[String(kind)] ?? CRIA_HEX.lilas;

  // O DESTINO das pautas. É o número que prova que a leitura de 3 créditos virou
  // post publicado e é o que ela mostra pro cliente na renovação do contrato.
  const usadas = (ideas ?? []).filter((i) => i.status === "usada").length;
  const marcadas = (ideas ?? []).filter((i) => i.status === "usar").length;
  const novas = (ideas ?? []).filter((i) => i.status === "novo").length;

  const temMenu = !!(aoRodarDeNovo || aoMover || aoDuplicar || onDelete);
  const excluir = async () => {
    if (!onDelete) return;
    if (await confirmar({
      titulo: "Excluir esta pesquisa?",
      descricao: "As pautas que ela gerou continuam no banco de ideias do cliente.",
      acao: "Excluir",
    })) onDelete();
  };

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden">
      {/* Cabeçalho na cor do módulo. O título diz o que a pesquisa SIGNIFICA,
          não o nome técnico dela ("Posts" vira "O que ele posta"). */}
      <div className="flex items-stretch" style={{ borderLeft: `4px solid ${hex}` }}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${hex}1f`, color: hex }}>
            <Instagram className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-display font-extrabold text-foreground truncate">
              {KIND_LABEL[kind] || "Pesquisa"}
            </span>
            <span className="block text-[11.5px] font-body text-muted-foreground truncate">
              @{shortHandle.replace(/^@/, "")}
              {count != null && ` · ${count} ${count === 1 ? "item lido" : "itens lidos"}`}
              {ideas && ideas.length > 0 && ` · ${ideas.length} pautas`}
              {quando && ` · ${haQuanto(quando)}`}
            </span>
          </span>
          {/* De qual cliente é. Só aparece no histórico geral, onde a pesquisa
              some no meio das outras se não disser de quem ela é. */}
          {clienteNome && (
            <span className="hidden sm:inline-block shrink-0 max-w-[140px] truncate rounded-full bg-muted px-2.5 py-1 text-[11px] font-body font-semibold text-muted-foreground">
              {clienteNome}
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
        </button>

        {temMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="shrink-0 px-3 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                aria-label="Ações desta pesquisa"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {aoRodarDeNovo && (
                <DropdownMenuItem onClick={aoRodarDeNovo}>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Pesquisar de novo
                </DropdownMenuItem>
              )}
              {clientes && clientes.length > 0 && aoMover && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Mover pra outro cliente
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                    <DropdownMenuLabel className="text-[11px]">Leva as pautas junto</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {clientes.map((c) => (
                      <DropdownMenuItem key={c.id} onClick={() => aoMover(c.id)}>{c.nome}</DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => aoMover(null)}>Tirar do cliente (avulsa)</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {clientes && clientes.length > 0 && aoDuplicar && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Copy className="h-3.5 w-3.5 mr-2" /> Copiar pra outro cliente
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                    <DropdownMenuLabel className="text-[11px]">Fica nos dois. Não gasta crédito.</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {clientes.map((c) => (
                      <DropdownMenuItem key={c.id} onClick={() => aoDuplicar(c.id)}>{c.nome}</DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={excluir} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir pesquisa
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* O DESTINO, sempre visível mesmo com o card fechado. Sem isso, a pessoa
          não sabe quais leituras ela já aproveitou e quais estão paradas. */}
      {ideas && ideas.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap border-t border-border/60 px-4 py-2">
          {usadas > 0 && (
            <span className="text-[11px] font-body font-bold px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700">
              {usadas} no cronograma
            </span>
          )}
          {marcadas > 0 && (
            <span className="text-[11px] font-body font-bold px-2 py-0.5 rounded-full" style={{ background: `${CRIA_HEX.lilas}22`, color: "#4a5cc0" }}>
              {marcadas} marcadas “usar”
            </span>
          )}
          {novas > 0 && (
            <span className="text-[11px] font-body px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {novas} {novas === 1 ? "nova · ninguém olhou" : "novas · ninguém olhou"}
            </span>
          )}
          {aoCriarPosts && marcadas > 0 && (
            <button
              onClick={aoCriarPosts}
              disabled={criandoPosts}
              className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-display font-bold text-primary hover:underline disabled:opacity-50"
            >
              {criandoPosts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
              Criar {marcadas} {marcadas === 1 ? "post" : "posts"}
            </button>
          )}
        </div>
      )}

      {open && (
      <div className="border-t border-border/60 p-4 sm:p-5">
        {/* A CONCLUSÃO, antes do dado. É o que ela leva pra reunião. */}
        {leitura && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl px-4 py-3" style={{ background: `${hex}0f` }}>
            <Sparkles className="h-4 w-4 shrink-0 mt-0.5" style={{ color: hex }} />
            <p className="text-[13px] font-body text-foreground leading-relaxed">{leitura}</p>
          </div>
        )}

        {kind === "profile" ? (
          <div className="flex items-start gap-4 flex-wrap">
            {s.avatar && (
              <img src={s.avatar} referrerPolicy="no-referrer" alt="" className="h-16 w-16 rounded-full object-cover border border-border shrink-0" />
            )}
            <div className="min-w-0 flex-1 w-full">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Stat label="Seguidores" value={fmtNum(s.followers)} />
                <Stat label="Seguindo" value={fmtNum(s.following)} />
                <Stat label="Posts" value={fmtNum(s.posts)} />
              </div>
              {s.biography && <p className="text-[13px] font-body text-muted-foreground mt-3 whitespace-pre-wrap leading-relaxed">{s.biography}</p>}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {s.verified && <span className="text-[10px] font-body px-2 py-0.5 rounded-full bg-primary/10 text-primary">✔ Verificado</span>}
                {s.isBusiness && <span className="text-[10px] font-body px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Comercial</span>}
                {s.category && <span className="text-[10px] font-body px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{s.category}</span>}
                {s.externalUrl && <a href={s.externalUrl} target="_blank" rel="noreferrer" className="text-[11px] font-body text-primary hover:underline truncate max-w-[240px]">{String(s.externalUrl).replace(/^https?:\/\//, "")}</a>}
              </div>
            </div>
          </div>

        ) : kind === "ads" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {Array.isArray(s.top) && s.top.slice(0, 12).map((a: Bruto, i: number) => {
              const abrir = a.library_link || a.link || null;
              return (
                <div key={i} className="rounded-2xl border border-border overflow-hidden bg-card">
                  {/* A CAPA. Ela vinha vazia porque o criativo do anúncio mora em
                      lugares diferentes conforme o formato, e a gente só olhava dois.
                      Agora ela é grande: o criativo É o produto desta pesquisa. */}
                  {a.thumbnail ? (
                    <a href={abrir ?? a.thumbnail} target="_blank" rel="noreferrer" className="group relative block bg-muted">
                      <img
                        src={a.thumbnail}
                        referrerPolicy="no-referrer"
                        alt=""
                        loading="lazy"
                        className="h-36 sm:h-44 w-full object-cover transition-transform group-hover:scale-[1.02]"
                        onError={(e) => { e.currentTarget.parentElement?.classList.add("hidden"); }}
                      />
                      <span className="absolute inset-0 grid place-items-center bg-foreground/0 transition-colors group-hover:bg-foreground/30">
                        <ExternalLink className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                    </a>
                  ) : null}

                  <div className="p-3.5">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      {a.active && (
                        <span className="text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">RODANDO</span>
                      )}
                      {a.since && (
                        <span className="text-[10.5px] font-body text-muted-foreground">
                          {/* Vinha "desde 1777446000" epoch cru na cara do usuário. */}
                          no ar desde {new Date(a.since).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>

                    {a.titulo && (
                      <p className="text-[13px] font-display font-bold text-foreground leading-snug mb-1">{a.titulo}</p>
                    )}
                    <p className="text-[12.5px] font-body text-foreground leading-relaxed line-clamp-5 whitespace-pre-wrap">
                      {a.text || "(anúncio sem texto)"}
                    </p>

                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      {a.cta && (
                        <span className="text-[10px] font-display font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary">{a.cta}</span>
                      )}
                      {abrir && (
                        <a href={abrir} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-body font-bold text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> ver o anúncio
                        </a>
                      )}
                      {aoUsarReferencia && (
                        <BotaoReferencia
                          rotulo="usar esse ângulo"
                          onClick={() => aoUsarReferencia({
                            title: String(a.titulo || a.text || "Ângulo de anúncio do concorrente").replace(/\s+/g, " ").slice(0, 160),
                            rationale: `Anúncio ativo do concorrente${a.cta ? ` (CTA: ${a.cta})` : ""}:\n${String(a.text || "").slice(0, 900)}`,
                            ref_url: abrir,
                          })}
                        />
                      )}
                    </div>
                    {a.link && (
                      <p className="mt-1.5 truncate text-[11px] font-body text-muted-foreground">
                        leva pra {String(a.link).replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        ) : kind === "comments" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {Array.isArray(s.top) && s.top.slice(0, 14).map((c: Bruto, i: number) => (
              <div key={i} className="flex items-start gap-2.5 rounded-2xl border border-border px-3 py-2.5">
                <MessageCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: hex }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-body text-foreground leading-relaxed">{c.text}</p>
                  {aoUsarReferencia && (
                    <div className="mt-1.5">
                      <BotaoReferencia
                        rotulo="responder isso num post"
                        onClick={() => aoUsarReferencia({
                          title: String(c.text || "").replace(/\s+/g, " ").slice(0, 160),
                          rationale: "Dúvida real do público, tirada dos comentários do concorrente. Responder isso em vídeo costuma render salvamento.",
                          ref_url: handle.startsWith("http") ? handle : null,
                        })}
                      />
                    </div>
                  )}
                </div>
                {c.likes > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] font-body text-muted-foreground shrink-0">
                    <Heart className="h-3 w-3" />{fmtNum(c.likes)}
                  </span>
                )}
              </div>
            ))}
          </div>

        ) : (
          <>
            {/* Sem número, sem card. Na transcrição de pesquisa antiga (antes do
                enriquecimento) as médias vinham zeradas e a tela mostrava uma
                fileira de "0", que parecia entrega quebrada. Só mostramos a
                média que existe de verdade. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              <Stat label={kind === "transcription" ? "Reels lidos" : "Posts lidos"} value={fmtNum(s.count)} />
              {(kind !== "transcription" || Number(s.avg_likes) > 0) && <Stat label="Média curtidas" value={fmtNum(s.avg_likes)} />}
              {(kind !== "transcription" || Number(s.avg_comments) > 0) && <Stat label="Média coment." value={fmtNum(s.avg_comments)} />}
              {(kind !== "transcription" || Number(s.avg_views) > 0) && <Stat label="Média views" value={s.avg_views ? fmtNum(s.avg_views) : "-"} />}
            </div>
            {Array.isArray(s.top) && s.top.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">
                  {kind === "transcription" ? "Os roteiros, do que mais rodou pro que menos" : "Do que mais engajou pro que menos"}
                </p>
                {s.top.slice(0, 10).map((p: Bruto, i: number) => (
                  <TopPostCard key={i} p={p} rank={i + 1} aoUsarReferencia={aoUsarReferencia} />
                ))}
              </div>
            )}
          </>
        )}

        {/* AS PAUTAS. É o produto. Antes ficavam enterradas no fim, com o mesmo
            peso visual de tudo o resto. Agora elas são o destaque. */}
        {ideas && ideas.length > 0 && onIdeaStatus && onIdeaDelete && (
          <div className="mt-5 rounded-2xl border-2 border-dashed p-4" style={{ borderColor: `${hex}59`, background: `${hex}08` }}>
            <p className="text-[13px] font-display font-extrabold text-foreground mb-0.5 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" style={{ color: hex }} />
              {ideas.length} {ideas.length === 1 ? "pauta pronta" : "pautas prontas"} pro seu cliente
            </p>
            <p className="text-[12px] font-body text-muted-foreground mb-3">
              Marque as boas como <strong>Usar</strong> e clique em “Criar posts” lá em cima: elas entram no cronograma dele.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {ideas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} onStatus={onIdeaStatus} onDelete={onIdeaDelete} />
              ))}
            </div>
          </div>
        )}

        {/* O custo real da leitura. Estava gravado no banco e nunca aparecia:
            quem paga por crédito tem direito de saber o que cada leitura consumiu. */}
        {typeof custo === "number" && custo > 0 && (
          <p className="mt-4 text-[10.5px] font-body text-muted-foreground/70">
            Custo desta leitura: US$ {custo.toFixed(3)}
          </p>
        )}
      </div>
      )}
    </div>
  );
}

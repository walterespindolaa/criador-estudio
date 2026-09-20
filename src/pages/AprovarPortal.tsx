import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, RotateCcw, Loader2, ImageOff, Heart, MessageCircle, Send, Bookmark, Zap, ListChecks, ChevronDown, Clapperboard, CalendarDays, BarChart3, CheckSquare, AlertTriangle, Package, Plus, FolderOpen, History, MapPin } from "lucide-react";
import { hexToHsl } from "@/lib/applyTheme";
import { PostMediaCarousel } from "@/components/shared/PostMediaCarousel";
import { type Alfinete } from "@/components/shared/CamadaDeAlfinetes";
import { StoryPreview } from "@/components/accounts/StoryPreview";
import { postAspect } from "@/lib/post-aspect";
import { EtapasChecklist, type Stage } from "@/components/aprovar/EtapasChecklist";
import { PortalCalendario } from "@/components/aprovar/PortalCalendario";
import { PortalRelatorio } from "@/components/aprovar/PortalRelatorio";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { LogoMarca } from "@/components/publico/CabecalhoPublico";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import { SolicitarMaterial } from "@/components/aprovar/SolicitarMaterial";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type MediaItem = {
  provider: string | null; thumbnail_url: string | null; view_url: string | null;
  download_url: string | null; bunny_video_id: string | null; file_type: string | null; file_name: string | null;
};
export type PortalPost = {
  post_id: string; title: string; platform: string; format: string;
  caption: string | null; hook: string | null; script: string | null; content_blocks: unknown;
  approval_mode: "fast" | "flow" | "both"; approval_stages: Record<string, string> | null;
  approval_status: "pendente" | "ajuste_solicitado" | "aprovado";
  scheduled_date: string | null; scheduled_time?: string | null; media: MediaItem[];
  last_comment: string | null; last_comment_role: string | null;
  // Link da pasta do Drive com os materiais do post (atalho pro cliente).
  drive_folder_url?: string | null;
};
type ClientHeader = { client_name: string; client_logo: string | null; manager_name: string | null; brand_color?: string | null; instagram_handle?: string | null };
// Histórico da conversa de ajuste de UM post, como a RPC pública devolve:
// só o lado ('cliente' = ele mesmo, 'equipe' = quem cuida do conteúdo), o
// texto e a data. Nada de nomes internos, ids de comentário ou etiquetas.
type PortalComment = {
  post_id: string; author_kind: "cliente" | "equipe"; content: string; created_at: string;
  /* Alfinete (circuito 6, 15/09/2026). Opcionais: comentário sem ponto na arte
     continua existindo e é o caso mais comum. Campos ausentes quando o banco
     ainda não rodou a migration, por isso `?`. */
  comment_id?: string; midia_indice?: number | null;
  ancora_x?: number | null; ancora_y?: number | null; ancora_seg?: number | null;
};
type PortalSettings = { show_calendar?: boolean; show_report?: boolean };
type PortalTab = "aprovacoes" | "calendario" | "relatorio";

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Aguardando você", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { label: "Ajuste solicitado", cls: "bg-orange-100 text-orange-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
};

// Escurece um hex (pct negativo) pra montar o gradiente do hero com a cor da marca.
function shadeHex(hex: string, pct: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const f = (i: number) => {
    const v = parseInt(clean.slice(i, i + 2), 16);
    const out = Math.min(255, Math.max(0, Math.round(v * (1 + pct / 100))));
    return out.toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(2)}${f(4)}`;
}

// Luminância relativa (0 = preto, 1 = branco). Usada pra escolher texto legível
// em cima da cor da marca: se a marca é clara (creme, bege, amarelo), texto
// branco some aí o botão usa texto escuro.
function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 1;
  const ch = (i: number) => {
    const v = parseInt(clean.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}
// Texto legível (HSL, pro --primary-foreground) em cima da cor da marca.
function readableFg(hex: string): string {
  return luminance(hex) > 0.6 ? "24 10% 12%" : "0 0% 100%";
}

function CardIG({ client, post, alfinetes, modoApontar, aoFixar, aoAbrirAlfinete, alfineteSelecionado }: {
  client: ClientHeader; post: PortalPost;
  alfinetes?: Record<number, Alfinete[]>; modoApontar?: boolean;
  aoFixar?: (indice: number, x: number, y: number) => void;
  aoAbrirAlfinete?: (id: string) => void; alfineteSelecionado?: string | null;
}) {
  const media = Array.isArray(post.media) ? post.media : [];
  // @ do Instagram: usa o handle real quando existe; senão placeholder neutro
  // ("perfil"), NUNCA o nome do cadastro do cliente.
  const handle = client.instagram_handle ? client.instagram_handle.replace(/^@/, "") : "perfil";
  const aspect = postAspect(post.platform, post.format);
  const vertical = aspect === "9 / 16";
  const brand = client.brand_color ?? null;
  // SÓ a legenda de verdade. O roteiro/copy (script) é material INTERNO de
  // produção e aparece no fluxo do CRONOGRAMA; na aprovação do post pronto ele
  // vazava inteiro ("SLIDE 1 - CAPA...") quando a legenda estava vazia.
  const legenda = post.caption || null;
  // Story tem preview próprio: tela cheia 9:16, sem legenda e sem ações de feed.
  if ((post.format || "").toLowerCase() === "story") {
    return (
      <article className="rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(27,26,24,0.07)]">
        <StoryPreview media={media} handle={handle} avatarUrl={client.client_logo} />
      </article>
    );
  }
  return (
    <article className="bg-white border border-border rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(27,26,24,0.07)]">
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0">
          <div className="relative w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
            <span className="text-xs font-extrabold text-primary">{(client.client_name || "?").charAt(0).toUpperCase()}</span>
            {client.client_logo?.trim() && <img src={client.client_logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
          </div>
        </div>
        <div className="min-w-0"><p className="text-[13px] font-bold text-foreground truncate leading-tight">{handle}</p><p className="text-[11px] text-muted-foreground leading-tight">Original audio</p></div>
        <span className="ml-auto text-foreground font-bold tracking-widest">···</span>
      </div>

      {media.length === 0 ? (
        // Placeholder de mídia vazio: fundo com a cor da marca a 8% + aviso amigável.
        <div className="flex flex-col items-center justify-center gap-3"
          style={{ aspectRatio: aspect, background: brand ? `${brand}14` : "hsl(var(--primary) / 0.08)" }}>
          <div className="w-14 h-14 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center">
            <Clapperboard className="h-6 w-6" style={{ color: brand ?? "hsl(var(--primary))" }} />
          </div>
          <p className="text-[13px] font-body font-semibold" style={{ color: brand ?? "hsl(var(--primary))" }}>Mídia em produção</p>
        </div>
      ) : vertical ? (
        <div className="relative">
          <PostMediaCarousel media={media} aspect={aspect} alfinetes={alfinetes} modoApontar={modoApontar} aoFixar={aoFixar} aoAbrirAlfinete={aoAbrirAlfinete} alfineteSelecionado={alfineteSelecionado} />
          {/* Véu de rodapé CURTO. Antes eram 2/5 da altura em black/70: aquilo existia
              pra dar contraste na legenda sobreposta, que foi removida daqui (ver o
              comentário logo abaixo) e o véu ficou órfão, escurecendo 40% do vídeo à
              toa. Era a "margem preta" que o cliente viu no celular. Agora é só o
              assento dos ícones e do botão do Drive, como no Instagram, e os ícones
              seguem com drop-shadow próprio pra legibilidade. */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          <div className="absolute right-3 bottom-16 z-10 flex flex-col items-center gap-4 text-white pointer-events-none [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.6))]">
            <Heart className="h-7 w-7" /><MessageCircle className="h-7 w-7" /><Send className="h-7 w-7" /><Bookmark className="h-7 w-7" />
          </div>
          {/* Legenda sobreposta REMOVIDA no vídeo/vertical: colidia com o botão "Assistir
              no Drive" e com o texto queimado do próprio vídeo (aquele amontoado no rodapé).
              A legenda completa já aparece no bloco "Legenda" (abaixo no mobile, ao lado no
              desktop), então nada se perde. */}
        </div>
      ) : (
        <>
          <PostMediaCarousel media={media} aspect={aspect} alfinetes={alfinetes} modoApontar={modoApontar} aoFixar={aoFixar} aoAbrirAlfinete={aoAbrirAlfinete} alfineteSelecionado={alfineteSelecionado} />
          <div className="flex items-center gap-4 px-3.5 pt-3 pb-1.5 text-foreground">
            <Heart className="h-6 w-6" /><MessageCircle className="h-6 w-6" /><Send className="h-6 w-6" /><Bookmark className="h-6 w-6 ml-auto" />
          </div>
          {/* No mock o caption é só um preview de 2 linhas (feito estilo feed). A legenda
              COMPLETA vive na coluna lateral (desktop) ou no bloco "Legenda" abaixo do
              card (mobile), pra todos os formatos, evitando duplicar o texto. */}
          {legenda && <p className="px-3.5 pb-4 text-[13.5px] leading-snug text-foreground line-clamp-2"><span className="font-bold mr-1.5">{handle}</span>{legenda}</p>}
        </>
      )}
    </article>
  );
}

// ── "Ver o que você pediu" ──────────────────────────────────────────────────
// Post reenviado depois de um ajuste: o cliente precisa comparar o que pediu
// com a versão nova antes de aprovar. Este bloco recolhível mostra a conversa
// daquele post (pedido dele + resposta da equipe), com data. Se o post nunca
// teve ajuste, o bloco nem aparece.
function HistoricoAjustes({ history, managerName }: { history: PortalComment[]; managerName: string | null }) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;
  // Data + hora curtas, no fuso do aparelho do cliente (página pública).
  const fmtData = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };
  return (
    <div className="mb-4 rounded-2xl border border-border bg-muted/30 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-muted/50 transition-colors">
        <span className="flex items-center gap-1.5 text-[13px] font-body font-bold text-foreground">
          <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> Ver o que você pediu ({history.length})
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2 max-h-64 overflow-y-auto">
          {history.map((h, i) => {
            const doCliente = h.author_kind === "cliente";
            return (
              <div key={i} className={`rounded-xl border px-3 py-2 ${doCliente ? "border-orange-100 bg-orange-50" : "border-primary/15 bg-primary/[0.04]"}`}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  {/* "Você" = o pedido do próprio cliente; a resposta leva o nome
                      de quem cuida do conteúdo (já público no header) ou "Equipe". */}
                  <span className={`text-[11px] font-body font-bold ${doCliente ? "text-orange-700" : "text-primary"}`}>
                    {doCliente ? "Você" : (managerName?.trim() || "Equipe")}
                  </span>
                  <span className="text-[10px] font-body text-muted-foreground shrink-0">{fmtData(h.created_at)}</span>
                </div>
                <p className="text-[12.5px] font-body text-foreground whitespace-pre-wrap leading-relaxed">{h.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PostApproval({ client, post, index, busy, history, onApproveFast, onAdjustFast, onApproveStage, onAdjustStage, onPin, onRemovePin }: {
  client: ClientHeader; post: PortalPost; index: number; busy: boolean; history: PortalComment[];
  onApproveFast: (id: string, comment?: string) => void; onAdjustFast: (id: string, comment: string) => void;
  onApproveStage: (id: string, stage: Stage, comment?: string) => void; onAdjustStage: (id: string, stage: Stage, comment: string) => void;
  onPin: (id: string, comment: string, indice: number, x: number, y: number) => void;
  onRemovePin: (commentId: string) => void;
}) {
  const mode = post.approval_mode ?? "fast";
  const [view, setView] = useState<"fast" | "flow">(mode === "flow" ? "flow" : "fast");
  const showFlow = view === "flow";
  const [adjOpen, setAdjOpen] = useState(false);
  const [comment, setComment] = useState("");
  const fullyApproved = post.approval_status === "aprovado";
  const vertical = postAspect(post.platform, post.format) === "9 / 16";
  const isStory = (post.format || "").toLowerCase() === "story";
  // SÓ a legenda (o roteiro/copy é interno; vive na aprovação do cronograma).
  const legenda = post.caption || null;

  const openAdjust = () => { setAdjOpen(true); setComment(""); };
  const sendFast = () => { onAdjustFast(post.post_id, comment.trim()); setAdjOpen(false); setComment(""); };
  /* Fecha a rodada: o texto (ou um resumo, quando só há alfinetes) vai como o
     comentário do ajuste, e os pontos já estão salvos na peça. */
  const sendFastComAlfinetes = (texto: string) => {
    onAdjustFast(post.post_id, texto);
    setAdjOpen(false); setComment(""); setApontando(false); setRascunhoAlfinete(null); setTextoAlfinete("");
  };

  /* ── APONTAR EM VEZ DE DESCREVER (circuito 6, 15/09/2026) ────────────────
     "O logo ficou estranho" faz o designer abrir a arte e adivinhar: tamanho?
     cor? posição? logo errado? Num carrossel de seis slides ele ainda tem que
     achar de qual slide ela fala. Cada rodada dessas custa uma revisão.

     O fluxo aqui tem três tempos de propósito:
       1. ela liga o modo apontar e clica na arte;
       2. escreve o que quer NAQUELE ponto (o alfinete fica salvo na hora);
       3. fecha a rodada uma vez só, com todos os pontos juntos.
     Fechar a rodada a cada alfinete devolveria o "pingado de áudio" que o
     produto combateu: revisão é uma rodada, não três. */
  const [apontando, setApontando] = useState(false);
  const [rascunhoAlfinete, setRascunhoAlfinete] = useState<{ indice: number; x: number; y: number } | null>(null);
  const [textoAlfinete, setTextoAlfinete] = useState("");
  const [alfineteAberto, setAlfineteAberto] = useState<string | null>(null);

  // Só os comentários que TÊM ponto viram alfinete, agrupados por slide.
  const meusAlfinetes = useMemo(
    () => history.filter((c) => c.ancora_x != null && c.ancora_y != null && c.comment_id),
    [history]);
  const alfinetesPorMidia = useMemo(() => {
    const m: Record<number, Alfinete[]> = {};
    for (const c of meusAlfinetes) {
      const i = c.midia_indice ?? 0;
      (m[i] ??= []).push({
        id: c.comment_id!, x: Number(c.ancora_x), y: Number(c.ancora_y),
        texto: c.content, deQuem: c.author_kind, segundo: c.ancora_seg ?? null,
      });
    }
    return m;
  }, [meusAlfinetes]);

  const fixarAlfinete = () => {
    if (!rascunhoAlfinete || !textoAlfinete.trim()) return;
    onPin(post.post_id, textoAlfinete.trim(), rascunhoAlfinete.indice, rascunhoAlfinete.x, rascunhoAlfinete.y);
    setRascunhoAlfinete(null); setTextoAlfinete("");
  };

  /* O RECADO DE QUEM APROVA.
     Antes só existia caixa de texto no AJUSTE. Quem queria elogiar escrevia
     ali mesmo, e o post voltava pro gestor marcado como "ajuste solicitado"
     com um elogio dentro: trabalho pronto voltando pra fila por falta de campo.
     Aqui o recado é OPCIONAL de verdade, e o botão de aprovar nunca fica
     desabilitado por causa dele. */
  // Recado enviado DEPOIS da aprovação: some o campo e vira confirmação.
  const [recadoEnviado, setRecadoEnviado] = useState(false);
  const [nota, setNota] = useState("");
  const LIMITE_NOTA = 140;
  // Aprovar é UM clique: o botão aprova de verdade, sem tela de confirmação.
  const sendApprove = () => onApproveFast(post.post_id);
  // O recado é um extra que vem DEPOIS, e também num clique. A mesma RPC
  // aceita ser chamada de novo com o post já aprovado: ela só grava o
  // comentário e mantém o status, então não precisa de rota nova.
  const enviarRecado = () => {
    const t = nota.trim();
    if (!t) return;
    onApproveFast(post.post_id, t);
    setNota(""); setRecadoEnviado(true);
  };

  // Bloco de STATUS no TOPO do painel de info (antes da legenda e das ações), tanto na
  // visão rápida quanto na detalhada: data, título "Esta publicação", selo de status e
  // formato/plataforma. Antes esses itens ficavam espalhados no meio do painel.
  const statusHeader = (
    <div className="mb-4">
      {post.scheduled_date && (
        <div className="flex items-center gap-1.5 text-sm font-display font-bold text-foreground mb-2 capitalize">
          <CalendarDays className="h-4 w-4 text-primary shrink-0" />
          {new Date(post.scheduled_date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
          {post.scheduled_time ? ` · ${String(post.scheduled_time).slice(0, 5)}` : ""}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h3 className="text-lg font-display font-extrabold text-foreground min-w-0 truncate">Esta publicação</h3>
        <span className={`shrink-0 whitespace-nowrap text-[11px] font-bold px-3 py-1 rounded-full ${STATUS[post.approval_status].cls}`}>{STATUS[post.approval_status].label}</span>
      </div>
      <p className="text-xs text-muted-foreground font-body capitalize">{post.format} · {post.platform}</p>
    </div>
  );

  // O painel de aprovação é um só (estado único) e muda de casa via CSS:
  // no mobile fica abaixo do preview, no desktop vira a coluna da direita.
  // Atalho pra pasta do Drive com os materiais do post (só link http válido).
  const driveFolder = (post.drive_folder_url ?? "").trim();
  const hasDriveFolder = /^https?:\/\//i.test(driveFolder);
  // Disclaimer de qualidade: só faz sentido pra vídeo (Reels/Story). O preview aqui
  // pode vir comprimido/em baixa; o arquivo original mora no Drive.
  const isVideoPost = ["reels", "video", "story"].includes((post.format || "").toLowerCase());

  const panel = (
    <>
      {/* Post REENVIADO depois de um ajuste (voltou pra "Aguardando você" com
          conversa registrada): o cliente compara o que pediu com a versão nova.
          Nos outros status o bloco não aparece (em ajuste, o "Você pediu" abaixo
          já mostra o último pedido). */}
      {post.approval_status === "pendente" && (
        <HistoricoAjustes history={history} managerName={client.manager_name} />
      )}
      {hasDriveFolder && (
        <button type="button" onClick={() => window.open(driveFolder, "_blank", "noopener,noreferrer")}
          className="w-full flex items-center gap-2 mb-4 rounded-2xl border border-primary/30 bg-primary/[0.05] px-3.5 py-2.5 text-left hover:bg-primary/10 transition-colors">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FolderOpen className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-body font-bold text-foreground leading-tight">Abrir pasta no Drive</span>
            <span className="block text-[11px] font-body text-muted-foreground">Materiais deste post</span>
          </span>
        </button>
      )}
      {/* Disclaimer de qualidade do vídeo: o preview daqui pode vir comprimido. Pra ver
          na qualidade real, abrir no Drive e baixar no computador ou celular. */}
      {isVideoPost && (
        <div className="flex items-start gap-2 mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[12px] font-body text-amber-900 leading-snug">
            Se o vídeo aparecer em baixa qualidade aqui, é normal (o preview é comprimido). Abra no Drive e baixe no seu computador ou celular pra ver na qualidade original.
          </p>
        </div>
      )}
      {mode === "both" && (
        <div className="flex bg-muted rounded-2xl p-1.5 mb-5">
          <button onClick={() => setView("fast")} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-body font-extrabold py-3 rounded-xl transition-colors ${view === "fast" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}><Zap className="h-4 w-4" /> Rápida</button>
          <button onClick={() => setView("flow")} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-body font-extrabold py-3 rounded-xl transition-colors ${view === "flow" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}><ListChecks className="h-4 w-4" /> Detalhada</button>
        </div>
      )}
      {!showFlow ? (
        <>
          {/* O gate do status faltava: sem ele, o recado de quem APROVOU aparecia
              como "Você pediu", virando elogio disfarçado de reclamação. */}
          {post.approval_status === "ajuste_solicitado" && post.last_comment && post.last_comment_role === "cliente_externo" && (
            <div className="text-xs font-body text-orange-700 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 mb-4 whitespace-pre-wrap">Você pediu:{"\n"}{post.last_comment}</div>
          )}
          {fullyApproved ? (
            /* APROVADO. O recado deixou de ser um pedágio antes do "aprovar"
               (dois cliques pra fazer uma coisa só) e virou um extra opcional
               aqui, depois: quem não quiser comentar já terminou. */
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-body font-bold text-green-700 bg-green-50 rounded-2xl px-4 py-3.5"><Check className="h-5 w-5" /> Aprovado, obrigada!</div>
              {recadoEnviado ? (
                <p className="text-[12.5px] font-body text-muted-foreground px-1">Recado enviado, valeu!</p>
              ) : (
                <>
                  <p className="text-[13px] font-body text-foreground font-semibold px-1">Quer deixar um recado? <span className="font-normal text-muted-foreground">(opcional)</span></p>
                  <Textarea
                    value={nota}
                    onChange={(e) => setNota(e.target.value.slice(0, LIMITE_NOTA))}
                    maxLength={LIMITE_NOTA}
                    placeholder="Ex.: amei esse, ficou a cara da marca"
                    className="rounded-2xl"
                    rows={2}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-body text-muted-foreground">{nota.length}/{LIMITE_NOTA}</p>
                    <Button variant="secondary" className="h-10 rounded-2xl" disabled={busy || !nota.trim()} onClick={enviarRecado}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar recado"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : !adjOpen ? (
            <div className="flex gap-3">
              {/* Um clique aprova. Nada de "confirmar aprovação" depois. */}
              <Button className="flex-1 h-14 rounded-2xl text-base font-bold shadow-lg shadow-primary/25" onClick={sendApprove} disabled={busy}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5 mr-1.5" /> Aprovar</>}</Button>
              <Button variant="secondary" className="h-14 rounded-2xl px-5" onClick={openAdjust} disabled={busy}><RotateCcw className="h-4 w-4 mr-1.5" /> Ajuste</Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* APONTAR NA ARTE. Fica ANTES da caixa de texto porque é o
                  caminho melhor: quem aponta escreve menos e é entendido mais.
                  A caixa continua ali pro que não é sobre um ponto (data,
                  legenda, estratégia). */}
              <div className="rounded-2xl border border-border p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[13px] font-body font-bold text-foreground">Prefere apontar?</p>
                    <p className="text-[12px] font-body text-muted-foreground leading-snug max-w-xs">
                      Marque na arte exatamente o que mudar. É mais rápido que descrever, e evita ida e volta.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant={apontando ? "default" : "outline"}
                    className="rounded-xl shrink-0"
                    onClick={() => { setApontando((v) => !v); setRascunhoAlfinete(null); }}>
                    <MapPin className="h-4 w-4 mr-1.5" /> {apontando ? "Parar de apontar" : "Apontar na arte"}
                  </Button>
                </div>

                {apontando && !rascunhoAlfinete && (
                  <p className="text-[12px] font-body text-primary font-semibold mt-2">
                    Toque no ponto da arte que você quer mudar.
                  </p>
                )}

                {/* O ponto foi marcado: agora ela diz o que quer ali. */}
                {rascunhoAlfinete && (
                  <div className="mt-2.5 space-y-2">
                    <Textarea value={textoAlfinete} onChange={(e) => setTextoAlfinete(e.target.value)}
                      placeholder="O que muda neste ponto? Ex.: o logo aqui ficou pequeno demais"
                      className="rounded-xl" rows={2} autoFocus />
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-xl flex-1" disabled={!textoAlfinete.trim()} onClick={fixarAlfinete}>
                        Marcar este ponto
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-xl"
                        onClick={() => { setRascunhoAlfinete(null); setTextoAlfinete(""); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Os pontos já marcados, numerados igual às bolinhas da arte.
                    Sem o número, três alfinetes viram três pontos idênticos e a
                    lista não casa com nada. */}
                {meusAlfinetes.length > 0 && (
                  <>
                  {/* O ponto é salvo no clique (nada se perde se o celular
                      travar), mas a RODADA só fecha no botão de enviar. Sem
                      esta linha ela marca três pontos, fecha a caixa achando
                      que mandou, e fica esperando uma resposta que não vem. */}
                  <p className="text-[11.5px] font-body text-muted-foreground mt-2.5">
                    Os pontos ficam salvos aqui. A equipe só é avisada quando você tocar em <b>Enviar ajuste</b>.
                  </p>
                  <ol className="mt-2 space-y-1.5">
                    {meusAlfinetes.map((c, i) => (
                      <li key={c.comment_id} className="flex items-start gap-2">
                        <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full grid place-items-center text-[10px] font-display font-extrabold text-white ${c.author_kind === "cliente" ? "bg-[#EA4918]" : "bg-[#7C90F0]"}`}>
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 text-[12.5px] font-body text-foreground leading-snug">{c.content}</span>
                        {c.author_kind === "cliente" && (
                          <button type="button" onClick={() => onRemovePin(c.comment_id!)}
                            className="text-[11px] font-body text-muted-foreground hover:text-destructive shrink-0">
                            tirar
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                  </>
                )}
              </div>

              <Textarea value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder={meusAlfinetes.length > 0
                  ? "Quer completar alguma coisa? (os pontos marcados já vão junto)"
                  : "O que você quer ajustar?"}
                className="rounded-2xl" rows={3} />
              <div className="flex gap-2.5">
                {/* Com ponto marcado, o texto vira opcional: o alfinete já diz
                    o que precisa. Sem ponto nenhum, texto continua obrigatório,
                    senão o ajuste chega vazio do outro lado. */}
                <Button className="flex-1 h-12 rounded-2xl"
                  disabled={busy || (!comment.trim() && meusAlfinetes.length === 0)}
                  onClick={() => {
                    const t = comment.trim();
                    sendFastComAlfinetes(t || `Marquei ${meusAlfinetes.length} ponto${meusAlfinetes.length === 1 ? "" : "s"} na arte.`);
                  }}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar ajuste"}
                </Button>
                <Button variant="ghost" className="h-12 rounded-2xl" onClick={() => { setAdjOpen(false); setApontando(false); setRascunhoAlfinete(null); }} disabled={busy}>Cancelar</Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EtapasChecklist
          post={post}
          busy={busy}
          onApproveStage={(stage, stageNote) => onApproveStage(post.post_id, stage, stageNote)}
          onAdjustStage={(stage, stageComment) => onAdjustStage(post.post_id, stage, stageComment)}
        />
      )}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.06, ease: "easeOut" }}
      className="mb-10 last:mb-0 lg:mb-8"
    >
      {/* Desktop (lg+): card horizontal com preview à esquerda e aprovação à direita.
          Mobile: mantém o feed em coluna, exatamente como antes. */}
      <div className="lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-8 lg:items-start lg:bg-white lg:border lg:border-border lg:rounded-3xl lg:p-6 lg:shadow-[0_8px_30px_rgba(27,26,24,0.06)]">
        <div className={`w-full mx-auto lg:mx-0 ${vertical ? "max-w-[330px] lg:max-w-[300px]" : "lg:max-w-[360px]"}`}>
          <CardIG client={client} post={post}
            alfinetes={alfinetesPorMidia} modoApontar={apontando}
            aoFixar={(indice, x, y) => setRascunhoAlfinete({ indice, x, y })}
            aoAbrirAlfinete={setAlfineteAberto} alfineteSelecionado={alfineteAberto} />
        </div>
        <div className="min-w-0">
          {/* No mobile a legenda completa aparece no bloco "Legenda" abaixo (lg:hidden),
              pra TODOS os formatos (inclusive Reels/Story vertical); no desktop o texto
              completo vem PRA CÁ, na coluna lateral, ao lado da mídia. */}
          <div className="bg-card border border-border rounded-3xl p-4 sm:p-6 mt-3 shadow-[0_8px_30px_rgba(27,26,24,0.05)] lg:bg-transparent lg:border-0 lg:rounded-none lg:p-0 lg:mt-0 lg:shadow-none">
            {/* Bloco de status (data, título, selo, formato) no TOPO, antes da legenda. */}
            {statusHeader}
            {/* MOBILE: legenda COMPLETA abaixo da mídia, respeitando quebras de linha
                (sem line-clamp). Vale pra todo formato, pois no vídeo/story o texto ou
                fica cortado no overlay ou nem aparece. No desktop some (lg:hidden). */}
            {legenda && (
              <div className="lg:hidden mb-5">
                <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Legenda</p>
                <p className="text-[13.5px] leading-snug text-foreground whitespace-pre-wrap">{legenda}</p>
              </div>
            )}
            {/* DESKTOP: legenda completa na coluna lateral (mantido como estava). */}
            {legenda && !isStory && (
              <div className="hidden lg:block mb-5">
                <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Legenda</p>
                <p className="text-[13.5px] leading-snug text-foreground whitespace-pre-wrap">{legenda}</p>
              </div>
            )}
            {panel}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AprovarPortal() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["portal-posts", token] });
    // O histórico de ajustes muda junto (o pedido recém-enviado entra nele).
    qc.invalidateQueries({ queryKey: ["portal-comments", token] });
  };
  // Página pública: força tema claro (o cliente pode estar no dark do sistema).
  useForceLightTheme();

  const clientQ = useQuery({
    queryKey: ["portal-client", token], enabled: !!token,
    queryFn: async () => {
      const { data, error } = await sbRpc("get_external_client_by_token", { _token: token });
      if (error) throw error;
      return ((data as ClientHeader[]) ?? [])[0] ?? null;
    },
  });
  const handleQ = useQuery({
    queryKey: ["portal-handle", token], enabled: !!token,
    queryFn: async () => {
      const { data } = await sbRpc("get_external_handle_by_token", { _token: token });
      return (typeof data === "string" ? data : null) as string | null;
    },
  });
  // Período do link (opcional). Se o social mídia gerou um link "só desse intervalo",
  // o portal mostra apenas os posts agendados dentro dele.
  const periodQ = useQuery({
    queryKey: ["portal-period", token], enabled: !!token,
    queryFn: async () => {
      const { data } = await sbRpc("get_token_period", { _token: token });
      const row = (data as { period_start: string | null; period_end: string | null }[] | null)?.[0];
      return row ?? { period_start: null, period_end: null };
    },
  });
  // Configuração do link feita pela gestora (abas extras do portal). Se a RPC ainda
  // não existir no banco, o portal segue só com a aba de aprovações (retrocompatível).
  const settingsQ = useQuery({
    queryKey: ["portal-settings", token], enabled: !!token,
    queryFn: async (): Promise<PortalSettings> => {
      const { data, error } = await sbRpc("get_portal_settings", { _token: token });
      if (error) return {};
      const row = (data as { settings: PortalSettings | null }[] | null)?.[0];
      return row?.settings ?? {};
    },
  });
  const postsQ = useQuery({
    queryKey: ["portal-posts", token, periodQ.data?.period_start, periodQ.data?.period_end],
    enabled: !!token && !!clientQ.data && !periodQ.isLoading,
    queryFn: async () => {
      const { data, error } = await sbRpc("list_posts_by_token", { _token: token });
      if (error) throw error;
      const all = (data as PortalPost[]) ?? [];
      const ps = periodQ.data?.period_start; const pe = periodQ.data?.period_end;
      if (!ps || !pe) return all;                       // sem período = tudo
      return all.filter((p) => !!p.scheduled_date && p.scheduled_date >= ps && p.scheduled_date <= pe);
    },
  });

  // Histórico de ajustes POR post (pedido do cliente + resposta da equipe).
  // Se a RPC ainda não existir no banco, o portal segue sem o bloco
  // (retrocompatível, mesmo padrão do get_portal_settings).
  const commentsQ = useQuery({
    queryKey: ["portal-comments", token], enabled: !!token && !!clientQ.data,
    queryFn: async (): Promise<Record<string, PortalComment[]>> => {
      const { data, error } = await sbRpc("list_post_comments_by_token", { _token: token });
      if (error) return {};
      const map: Record<string, PortalComment[]> = {};
      for (const c of (data as PortalComment[]) ?? []) (map[c.post_id] ??= []).push(c);
      return map;
    },
  });

  // O "Não foi possível aprovar" seco escondia o MOTIVO real do banco. Agora o
  // erro vira mensagem útil (link fora do período, link expirado...) e o
  // detalhe cru vai pro console, pra dar pra depurar pelo print do cliente.
  const motivoErro = (e: unknown, acao: string): string => {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e ?? "");
    console.error(`[aprovar-portal] ${acao} falhou:`, e);
    if (/fora do periodo/i.test(msg)) return "Este link cobre outro período e este post ficou de fora. Peça um link novo pra sua social mídia.";
    if (/invalid_token/i.test(msg)) return "Este link expirou ou foi desativado. Peça um link novo pra sua social mídia.";
    if (/post_not_found/i.test(msg)) return "Este post não está mais disponível. Atualize a página.";
    if (/has_module|module/i.test(msg)) return "O módulo de aprovação está inativo. Avise sua social mídia.";
    if (/muitos_alfinetes/i.test(msg)) return "Você já marcou 20 pontos nesta peça. Envie o ajuste e continue na próxima rodada.";
    if (/could not find the function|does not exist|schema cache/i.test(msg)) return "Marcar pontos na arte ainda não está ligado nesta conta. Escreva o ajuste no campo abaixo.";
    return msg ? `${acao} falhou: ${msg}` : `${acao} falhou. Tente de novo.`;
  };
  const approveFast = useMutation({ mutationFn: async ({ id, comment }: { id: string; comment?: string }) => { const { error } = await sbRpc("approve_post_by_token", { _token: token, _post_id: id, _comment: comment ?? null }); if (error) throw error; }, onSuccess: (_d, v) => { toast.success(v?.comment ? "Aprovado, recado enviado!" : "Aprovado!"); inv(); }, onError: (e) => toast.error(motivoErro(e, "Aprovar")) });
  const adjustFast = useMutation({ mutationFn: async ({ id, comment }: { id: string; comment: string }) => { const { error } = await sbRpc("request_adjustment_by_token", { _token: token, _post_id: id, _comment: comment }); if (error) throw error; }, onSuccess: () => { toast.success("Ajuste enviado!"); inv(); }, onError: (e) => toast.error(motivoErro(e, "Enviar o ajuste")) });
  /* ── ALFINETE (circuito 6) ───────────────────────────────────────────────
     Marcar um ponto NÃO muda o status da peça: o ajuste é fechado uma vez só,
     depois, com todos os pontos juntos. Se a migration ainda não rodou, a RPC
     não existe e o aviso diz isso em português, sem quebrar o portal. */
  const pinPoint = useMutation({
    mutationFn: async ({ id, comment, indice, x, y }: { id: string; comment: string; indice: number; x: number; y: number }) => {
      const { error } = await sbRpc("pin_comment_by_token", {
        _token: token, _post_id: id, _comment: comment,
        _midia_indice: indice, _ancora_x: x, _ancora_y: y, _ancora_seg: null,
      });
      if (error) throw error;
    },
    onSuccess: () => { inv(); },
    onError: (e) => toast.error(motivoErro(e, "Marcar o ponto")),
  });
  const removePin = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await sbRpc("remove_pin_by_token", { _token: token, _comment_id: commentId });
      if (error) throw error;
    },
    onSuccess: () => { inv(); },
    onError: (e) => toast.error(motivoErro(e, "Tirar o ponto")),
  });

  const approveStage = useMutation({ mutationFn: async ({ id, stage, comment }: { id: string; stage: Stage; comment?: string }) => { const { error } = await sbRpc("approve_stage_by_token", { _token: token, _post_id: id, _stage: stage, _comment: comment ?? null }); if (error) throw error; }, onSuccess: () => { toast.success("Etapa aprovada!"); inv(); }, onError: (e) => toast.error(motivoErro(e, "Aprovar a etapa")) });
  const adjustStage = useMutation({ mutationFn: async ({ id, stage, comment }: { id: string; stage: Stage; comment: string }) => { const { error } = await sbRpc("request_stage_adjustment_by_token", { _token: token, _post_id: id, _stage: stage, _comment: comment }); if (error) throw error; }, onSuccess: () => { toast.success("Ajuste enviado!"); inv(); }, onError: (e) => toast.error(motivoErro(e, "Enviar o ajuste")) });

  // Qual post está em ação AGORA. Só ele trava; os outros seguem clicáveis.
  let pendingId: string | null = null;
  if (approveFast.isPending && approveFast.variables) {
    pendingId = approveFast.variables.id;
  } else if (adjustFast.isPending && adjustFast.variables) {
    pendingId = adjustFast.variables.id;
  } else if (approveStage.isPending && approveStage.variables) {
    pendingId = approveStage.variables.id;
  } else if (adjustStage.isPending && adjustStage.variables) {
    pendingId = adjustStage.variables.id;
  }

  const [showApproved, setShowApproved] = useState(false);
  const [tab, setTab] = useState<PortalTab>("aprovacoes");

  // Registra que o cliente abriu o portal (fire and forget, não bloqueia nada).
  useEffect(() => {
    if (!token) return;
    sbRpc("portal_mark_viewed", { _token: token }).then(() => undefined, () => undefined);
  }, [token]);

  if (clientQ.isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (clientQ.isError || !clientQ.data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4"><ImageOff className="h-6 w-6 text-muted-foreground" /></div>
          <h1 className="font-display font-bold text-foreground text-lg">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">Peça um novo link de aprovação pra quem cuida do seu conteúdo.</p>
        </div>
      </div>
    );
  }

  const c: ClientHeader = { ...clientQ.data, instagram_handle: handleQ.data ?? null };
  const posts = postsQ.data ?? [];
  // Ordem do feed: pendentes primeiro, depois em ajuste; aprovados ficam num grupo colapsado.
  const pendentes = posts.filter((p) => p.approval_status === "pendente");
  const emAjuste = posts.filter((p) => p.approval_status === "ajuste_solicitado");
  const aprovados = posts.filter((p) => p.approval_status === "aprovado");
  const fila = [...pendentes, ...emAjuste];
  const total = posts.length;
  const brand = c.brand_color ?? null;
  // Cor da marca do cliente vira o accent local da página (CSS vars no wrapper).
  const brandVars = (brand
    ? { "--primary": hexToHsl(brand), "--ring": hexToHsl(brand), "--primary-foreground": readableFg(brand) }
    : {}) as CSSProperties;
  const heroBg = brand
    ? `linear-gradient(130deg, ${brand} 0%, ${shadeHex(brand, -32)} 100%)`
    : "linear-gradient(130deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.75) 100%)";

  const settings = settingsQ.data ?? {};
  const tabs: { key: PortalTab; label: string; icon: typeof CheckSquare }[] = [
    { key: "aprovacoes", label: "Aprovações", icon: CheckSquare },
    ...(settings.show_calendar ? [{ key: "calendario" as const, label: "Calendário", icon: CalendarDays }] : []),
    ...(settings.show_report ? [{ key: "relatorio" as const, label: "Relatório", icon: BarChart3 }] : []),
  ];
  const activeTab: PortalTab = tabs.some((t) => t.key === tab) ? tab : "aprovacoes";

  const renderPost = (p: PortalPost, i: number) => (
    <PostApproval key={p.post_id} client={c} post={p} index={i} busy={pendingId === p.post_id}
      history={commentsQ.data?.[p.post_id] ?? []}
      onApproveFast={(id, comment) => approveFast.mutate({ id, comment })}
      onAdjustFast={(id, comment) => adjustFast.mutate({ id, comment })}
      onApproveStage={(id, stage, comment) => approveStage.mutate({ id, stage, comment })}
      onAdjustStage={(id, stage, comment) => adjustStage.mutate({ id, stage, comment })}
      onPin={(id, comment, indice, x, y) => pinPoint.mutate({ id, comment, indice, x, y })}
      onRemovePin={(commentId) => removePin.mutate(commentId)} />
  );

  const tabBar = (variant: "mobile" | "desktop") =>
    tabs.length > 1 && (
      <div className={variant === "mobile"
        ? "flex bg-muted/70 rounded-2xl p-1 mx-4 mb-2.5"
        : "inline-flex bg-white border border-border rounded-2xl p-1.5 shadow-[0_4px_20px_rgba(27,26,24,0.06)]"}>
        {tabs.map((t) => {
          const on = activeTab === t.key;
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 text-[13px] font-body font-extrabold rounded-xl transition-colors ${variant === "mobile" ? "py-2.5 min-h-[44px]" : "px-5 py-2.5"} ${on ? "bg-white text-primary shadow-sm lg:bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>
    );

  return (
    <div className="min-h-screen bg-background" style={brandVars}>
      {/* Faixa do Cria acima de tudo, fora da área de marca do cliente. */}
      <AssinaturaCria variante="topo" tom="claro" />

      {/* ── Header mobile: barra compacta e fixa (como sempre foi) ── */}
      <header className="lg:hidden border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <LogoMarca src={c.client_logo} nome={c.client_name} tamanho="sm" comFallback
            formato="avatar" cor={brand ?? "#CE4A1D"} fundo="#ffffff" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-foreground truncate leading-tight">{c.client_name}</p>
            {c.manager_name && <p className="text-[11px] text-muted-foreground font-body truncate">conteúdo por {c.manager_name}</p>}
          </div>
          {total > 0 && (
            <div className="text-right shrink-0">
              <p className="text-sm font-display font-extrabold text-primary leading-tight">{aprovados.length} de {total}</p>
              <p className="text-[10px] text-muted-foreground font-body">aprovados</p>
            </div>
          )}
        </div>
        {tabBar("mobile")}
        <div className="h-1 bg-primary/10">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: total ? `${(aprovados.length / total) * 100}%` : "0%" }} />
        </div>
      </header>

      {/* ── Hero desktop: faixa com a cor da marca do cliente ── */}
      <div className="hidden lg:block" style={{ background: heroBg }}>
        <div className="max-w-5xl mx-auto px-8 pt-12 pb-10">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }} className="flex items-center gap-6">
            <LogoMarca src={c.client_logo} nome={c.client_name} tamanho="lg" comFallback
              formato="avatar" cor={brand ?? "#CE4A1D"} fundo="#ffffff" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display font-extrabold text-white text-3xl tracking-tight truncate">{c.client_name}</h1>
              {c.manager_name && <p className="text-sm text-white/80 font-body mt-0.5">conteúdo por {c.manager_name}</p>}
            </div>
            {total > 0 && (
              <div className="text-right shrink-0">
                <p className="text-3xl font-display font-extrabold text-white leading-tight">{aprovados.length}<span className="text-white/60 text-xl"> de {total}</span></p>
                <p className="text-[11px] text-white/80 font-body uppercase tracking-wider">posts aprovados</p>
              </div>
            )}
          </motion.div>
          {total > 0 && (
            <div className="mt-6 h-1.5 rounded-full bg-white/25 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: total ? `${(aprovados.length / total) * 100}%` : "0%" }} transition={{ duration: 0.7, ease: "easeOut" }} className="h-full rounded-full bg-white" />
            </div>
          )}
        </div>
      </div>

      {/* ── Abas desktop ── */}
      {tabs.length > 1 && (
        <div className="hidden lg:flex justify-center sticky top-0 z-20 -mt-6 pb-2">
          {tabBar("desktop")}
        </div>
      )}

      <main className={`mx-auto px-4 py-6 ${activeTab === "aprovacoes" ? "max-w-md lg:max-w-5xl lg:px-8 lg:py-10" : "max-w-md lg:max-w-4xl lg:px-8 lg:py-10"}`}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeOut" }}>
            {activeTab === "calendario" ? (
              <PortalCalendario posts={posts} brand={brand} />
            ) : activeTab === "relatorio" ? (
              <PortalRelatorio posts={posts} client={{ name: c.client_name, logo: c.client_logo, manager: c.manager_name }} brand={brand}
                periodStart={periodQ.data?.period_start ?? null} periodEnd={periodQ.data?.period_end ?? null} />
            ) : (
              <>
                <div className="text-center mb-6 lg:mb-10">
                  <h1 className="font-display font-extrabold text-foreground text-xl lg:text-2xl">Aprove seus posts</h1>
                  <p className="text-sm text-muted-foreground font-body mt-1">Revise o conteúdo e aprove ou peça ajustes.</p>
                </div>

                {postsQ.isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : postsQ.isError ? (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-6 w-6 text-amber-600" /></div>
                    <p className="font-display font-bold text-foreground text-lg">Não consegui carregar seus posts</p>
                    <p className="text-sm text-muted-foreground font-body mt-1 mb-5">Parece que a conexão falhou. Verifique sua internet e tente de novo.</p>
                    <Button onClick={() => postsQ.refetch()} disabled={postsQ.isFetching}>
                      {postsQ.isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />} Tentar de novo
                    </Button>
                  </div>
                ) : total === 0 ? (
                  <div className="text-center py-16 text-muted-foreground font-body"><Check className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium text-foreground">Tudo em dia!</p><p className="text-sm mt-1">Nenhum post aguardando sua revisão agora.</p></div>
                ) : (
                  <>
                    {fila.length === 0 ? (
                      <div className="text-center bg-green-50 border border-green-100 rounded-3xl px-4 py-8 mb-6">
                        <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-3"><Check className="h-6 w-6" strokeWidth={3} /></div>
                        <p className="font-display font-extrabold text-green-800">Tudo aprovado, obrigado!</p>
                        <p className="text-[13px] font-body text-green-700 mt-1">Nenhum post esperando sua revisão agora.</p>
                      </div>
                    ) : (
                      fila.map(renderPost)
                    )}

                    {aprovados.length > 0 && (
                      <section className="mt-2 lg:mt-6">
                        <button type="button" onClick={() => setShowApproved((v) => !v)} aria-expanded={showApproved}
                          className="w-full min-h-[48px] flex items-center justify-between gap-2 bg-card border border-border rounded-2xl px-4 py-3 hover:bg-muted/40 transition-colors">
                          <span className="flex items-center gap-2.5 text-sm font-body font-bold text-foreground">
                            <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                            Aprovados ({aprovados.length})
                          </span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showApproved ? "rotate-180" : ""}`} />
                        </button>
                        {showApproved && <div className="mt-6">{aprovados.map(renderPost)}</div>}
                      </section>
                    )}
                  </>
                )}

                <SolicitarMaterial token={token} />
              </>
            )}
          </motion.div>
        </AnimatePresence>
        {/* Crédito de rodapé (esta página o CLIENTE vê): mesma assinatura das
            outras páginas públicas, agora clicável. */}
        <AssinaturaCria variante="rodape" tom="claro" style={{ paddingTop: 32, paddingBottom: 40 }} />
      </main>
    </div>
  );
}

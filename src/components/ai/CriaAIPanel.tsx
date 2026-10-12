import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3, CalendarDays, CircleHelp, Clapperboard, Copy, Flame, History, Lightbulb, Loader2, Minus, PenLine, Plus, Send, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogPortal } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import { useIdeas } from "@/hooks/useIdeas";
import { useCriaAI } from "@/contexts/CriaAIContext";
import { useBrandContext } from "@/hooks/useBrandContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTour } from "@/components/tour/TourProvider";
import {
  quandoFoi, useCriaConversas, useSalvarConversa, type ConversaCria, type IdeiaCria, type MensagemCria,
} from "@/hooks/useCriaConversas";
import DOMPurify from "dompurify";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA IA, VERSÃO 2 (Walter, 12/10/2026: "aumentar ele quando for na web, ter
   um botão pra ver histórico que abre um popup mostrando as últimas 10, no
   formato atual é ruim e poderia ser mais interativo")

   - Web: painel grande no centro (até 1040px), conversa numa coluna de leitura.
   - Celular: tela cheia, topo e campo de escrever respeitando a área segura
     (notch, barra de status, barra de gestos). Nada fica atrás do relógio.
   - Histórico: as 10 conversas mais recentes, guardadas no banco.
   - Interativo: quando a resposta tem ideias, cada uma vira um cartão com
     Salvar no banco de ideias / Virar roteiro / Copiar, e a IA sugere os
     próximos pedidos em botões embaixo da resposta.

   As ideias vêm num bloco ```cria com JSON no fim da resposta. O pedido desse
   formato vai junto da mensagem (FORMATO_CRIA), daqui do app, pra não depender
   de publicar a edge. Se o bloco vier quebrado, a resposta aparece como texto.
   ═══════════════════════════════════════════════════════════════════════════ */

type QuickAction = {
  label: string;
  desc: string;
  Icon: LucideIcon;
  color: string;
  /** Ícone escuro (no amarelo e no rosa, onde branco teria baixo contraste). */
  dark?: boolean;
  build: (ctx: { niche: string; lastPostTitle: string; postsCount: number; ideasCount: number; weeklyGoal: number }) => string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Ideia de post", desc: "3 ideias pro seu nicho essa semana", Icon: Lightbulb, color: "#FFCF03", dark: true,
    build: ({ niche }) => `Me dá 3 ideias de post pro meu nicho de ${niche || "criação de conteúdo"} pra essa semana.`,
  },
  {
    label: "Roteiro de reels", desc: "Gancho, meio e chamada pra ação", Icon: Clapperboard, color: "#0061EE",
    build: ({ lastPostTitle, niche }) =>
      `Escreve um roteiro de reels curto sobre "${lastPostTitle || `o meu nicho de ${niche || "criação"}`}", com gancho, desenvolvimento e chamada pra ação.`,
  },
  {
    label: "Escrever legenda", desc: "No seu tom, pronta pra colar", Icon: PenLine, color: "#01A652",
    build: ({ lastPostTitle, niche }) =>
      `Escreve uma legenda descontraída pra um reels sobre "${lastPostTitle || `o meu nicho de ${niche || "criação"}`}".`,
  },
  {
    label: "Planejar semana", desc: "Distribui os posts pela sua meta", Icon: CalendarDays, color: "#FF77B9", dark: true,
    build: ({ niche, weeklyGoal }) =>
      `Me ajuda a planejar minha semana de conteúdo no nicho de ${niche || "criação"} com ${weeklyGoal} posts.`,
  },
  {
    label: "Trends do momento", desc: "O que está bombando no seu nicho", Icon: Flame, color: "#EA4918",
    build: ({ niche }) =>
      `Busque as 5 trends mais virais agora no Instagram/TikTok pro nicho de ${niche || "lifestyle"} no Brasil e me dê ideias de como adaptar cada uma pro meu conteúdo.`,
  },
  {
    label: "Analisar meu perfil", desc: "Consistência, meta e próximos passos", Icon: BarChart3, color: "#9FB7FF", dark: true,
    build: ({ postsCount, ideasCount, weeklyGoal }) =>
      `Analisa minha consistência: tenho ${postsCount} posts publicados, ${ideasCount} ideias e minha meta é ${weeklyGoal}/semana. O que você sugere?`,
  },
];

/** Vai junto de cada mensagem pra IA. Não aparece pra pessoa nem entra no histórico. */
const FORMATO_CRIA = `

[FORMATO DA RESPOSTA, siga sem comentar]
Se a resposta trouxer ideias (de post, stories, reels, pauta), escreva só 1 ou 2 frases de abertura e coloque CADA ideia no bloco abaixo, sem repetir as ideias no texto.
Termine SEMPRE com o bloco abaixo, mesmo sem ideias (aí "ideias" fica []):
\`\`\`cria
{"ideias":[{"titulo":"nome curto","descricao":"o que mostrar, em 1 ou 2 frases","texto_tela":"frase pronta pra tela ou legenda","formato":"Reels, Stories, Carrossel ou Estático"}],"sugestoes":["próximo pedido curto","outro próximo pedido"]}
\`\`\`
"sugestoes": 2 a 4 pedidos curtos (até 5 palavras) que a pessoa pode fazer em seguida nesta conversa.`;

const CORES_IDEIA = ["#FFCF03", "#FF77B9", "#9FB7FF", "#9DDBB5", "#FFB59A"];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderMarkdown(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "• $1")
    .replace(/^\d+\. (.+)$/gm, (_match, content) => `• ${content}`)
    .replace(/\n/g, "<br />");
}

/** Separa o texto da resposta do bloco ```cria (ou ```json) com as ideias. */
export function separarResposta(raw: string): { texto: string; ideias: IdeiaCria[]; sugestoes: string[] } {
  const re = /```(?:cria|json)\s*([\s\S]*?)(?:```|$)/gi;
  let ultimo: RegExpExecArray | null = null;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    ultimo = m;
    if (m[0].length === 0) break;
  }
  if (!ultimo) return { texto: raw.replace(/```\w*\n?|\n?```/g, "").trim(), ideias: [], sugestoes: [] };
  const texto = (raw.slice(0, ultimo.index) + raw.slice(ultimo.index + ultimo[0].length)).replace(/```\w*\n?|\n?```/g, "").trim();
  try {
    const bruto = ultimo[1].trim();
    const obj = JSON.parse(bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1)) as { ideias?: unknown; sugestoes?: unknown };
    const ideias = (Array.isArray(obj.ideias) ? obj.ideias : [])
      .filter((i): i is IdeiaCria => !!i && typeof i === "object" && typeof (i as IdeiaCria).titulo === "string" && !!(i as IdeiaCria).titulo.trim())
      .slice(0, 6);
    const sugestoes = (Array.isArray(obj.sugestoes) ? obj.sugestoes : [])
      .filter((s): s is string => typeof s === "string" && !!s.trim() && s.length <= 60)
      .slice(0, 4);
    return { texto, ideias, sugestoes };
  } catch {
    // Bloco quebrado (resposta cortada): mostra o que deu de texto e avisa.
    const base = texto || raw.replace(/```\w*\n?|\n?```/g, "").trim();
    return { texto: `${base}\n\nA resposta veio cortada no meio. Pede de novo que eu refaço.`.trim(), ideias: [], sugestoes: [] };
  }
}

/** O que a IA "lembra" de uma resposta com cartões: o texto mais as ideias. */
function paraHistorico(m: MensagemCria) {
  if (!m.ideias?.length) return m.content;
  return `${m.content}\n${m.ideias.map((i, n) => `Ideia ${n + 1}: ${i.titulo}. ${i.descricao ?? ""}`).join("\n")}`;
}

function textoDaIdeia(i: IdeiaCria) {
  return [i.titulo, i.descricao, i.texto_tela ? `Texto na tela: ${i.texto_tela}` : ""].filter(Boolean).join("\n");
}

/** O "C" da marca num blob amarelo: o rosto da Cria IA. */
function AvatarCria({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("grid place-items-center shrink-0 bg-[#FFCF03] rounded-[38%_62%_55%_45%/48%_42%_58%_52%]", className)}
      style={{ width: size, height: size }}
    >
      <img src="/logo-icon-sm.png" alt="" draggable={false} className="object-contain" style={{ width: size * 0.7, height: size * 0.7 }} />
    </span>
  );
}

export function CriaAIPanel() {
  const { open, closeCria, consumeInitialPrompt } = useCriaAI();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { profile } = useProfile();
  // Só busca posts e ideias com o painel aberto (pente fino 23/09).
  const { posts } = usePosts({ enabled: open });
  const { ideas, createIdea } = useIdeas({ enabled: open });
  const { brandContext, hasBrandContext } = useBrandContext();
  const { startTour } = useTour();
  const { data: conversas = [] } = useCriaConversas(open);
  const salvarConversa = useSalvarConversa();

  const [messages, setMessages] = useState<MensagemCria[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [unread, setUnread] = useState(0);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [salvas, setSalvas] = useState<Set<string>>(() => new Set());
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const primeiroNome = profile?.name?.split(" ")[0] ?? "";

  const ctx = useMemo(() => {
    const publishedPosts = posts.filter((p) => p.status === "publicado");
    const lastPostTitle = publishedPosts[publishedPosts.length - 1]?.title ?? posts[posts.length - 1]?.title ?? "";
    return {
      niche: profile?.niche ?? "",
      lastPostTitle,
      postsCount: publishedPosts.length,
      ideasCount: ideas.length,
      weeklyGoal: profile?.weekly_goal ?? 3,
    };
  }, [posts, ideas, profile]);

  useEffect(() => {
    if (!scrollAreaRef.current) return;
    scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open && !minimized) setUnread(0);
  }, [open, minimized]);

  useEffect(() => {
    if (!open) {
      setMinimized(false);
      setUnread(0);
      setHistoricoAberto(false);
    }
  }, [open]);

  /** `base` é a conversa em cima da qual a mensagem vai: quem acabou de zerar
   *  a conversa (prompt vindo de outra tela) passa [] sem esperar o estado. */
  const sendMessage = async (text: string, base: MensagemCria[] = messages, idBase: string | null = conversaId) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: MensagemCria = { id: uid(), role: "user", content: trimmed, timestamp: Date.now() };
    const comPergunta = [...base, userMsg];
    setMessages(comPergunta);
    setInput("");
    setLoading(true);

    let resposta: MensagemCria;
    try {
      const recentTitles = posts.slice(-5).map((p) => p.title).filter(Boolean);
      const raw = await callAIContextBuilder({
        userId: user?.id,
        operation: "cria-chat",
        data: {
          mensagem: trimmed + FORMATO_CRIA,
          nome: profile?.name,
          nicho: profile?.niche,
          plataformas: profile?.platforms ?? [],
          meta_semanal: profile?.weekly_goal,
          ultimos_posts: recentTitles,
          historico: base.slice(-6).map((m) => ({ role: m.role, content: paraHistorico(m) })),
          brandContext,
        },
      });
      const { texto, ideias, sugestoes } = separarResposta(typeof raw === "string" ? raw : raw ? String(raw) : "");
      resposta = {
        id: uid(),
        role: "assistant",
        content: texto || (ideias.length ? "" : "Não consegui gerar uma resposta agora. Tenta de novo daqui a pouco."),
        timestamp: Date.now(),
        ...(ideias.length ? { ideias } : {}),
        ...(sugestoes.length ? { sugestoes } : {}),
      };
    } catch (e) {
      console.error("Cria chat failed", e);
      toast.error("Não consegui responder agora. Tenta de novo.");
      resposta = { id: uid(), role: "assistant", content: "Algo deu errado aqui do meu lado. Tenta de novo daqui a pouco?", timestamp: Date.now() };
    } finally {
      setLoading(false);
    }

    const conversa = [...comPergunta, resposta];
    setMessages(conversa);
    if (minimized) setUnread((u) => u + 1);
    const titulo = conversa.find((m) => m.role === "user")?.content ?? "Conversa";
    salvarConversa.mutate(
      { id: idBase, titulo, mensagens: conversa },
      { onSuccess: (id) => { if (id && !idBase) setConversaId(id); } },
    );
  };

  const novaConversa = () => {
    setMessages([]);
    setConversaId(null);
    setInput("");
    setHistoricoAberto(false);
  };

  const abrirConversa = (c: ConversaCria) => {
    setMessages(Array.isArray(c.mensagens) ? c.mensagens : []);
    setConversaId(c.id);
    setHistoricoAberto(false);
  };

  // Pedido vindo de outra tela (openCria("...")) começa conversa nova.
  useEffect(() => {
    if (!open) return;
    const pending = consumeInitialPrompt();
    if (pending) {
      setMessages([]);
      setConversaId(null);
      void sendMessage(pending, [], null);
    }
  }, [open, consumeInitialPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvarIdeia = async (msgId: string, idx: number, i: IdeiaCria) => {
    const chave = `${msgId}:${idx}`;
    if (salvas.has(chave)) return;
    try {
      await createIdea.mutateAsync({
        title: i.titulo.slice(0, 200),
        notes: [i.descricao, i.texto_tela ? `Texto na tela: ${i.texto_tela}` : ""].filter(Boolean).join("\n\n") || null,
        origin: "cria_ia",
        idea_status: "nova",
      });
      setSalvas((s) => new Set(s).add(chave));
      toast.success("Salva no seu banco de ideias.");
    } catch {
      toast.error("Não consegui salvar a ideia. Tenta de novo.");
    }
  };

  const copiar = (texto: string) => {
    void navigator.clipboard?.writeText(texto).then(
      () => toast.success("Copiado."),
      () => toast.error("Não consegui copiar."),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleClose = () => {
    closeCria();
    setMinimized(false);
  };

  const dialogOpen = open && !minimized;
  const showFab = open && minimized;
  const hasMessages = messages.length > 0;
  const ultimaIA = [...messages].reverse().find((m) => m.role === "assistant");

  /* CELULAR: tela cheia, fluida. O topo desce o tamanho da área segura (notch
     e barra de status) e o campo de escrever sobe o da barra de gestos, então
     fechar e digitar ficam sempre ao alcance, sem nada escondido atrás do
     relógio. Estilo inline vence as classes de centralização do Dialog. */
  const mobilePanelStyle: React.CSSProperties | undefined = isMobile
    ? { top: 0, left: 0, transform: "none", width: "100%", maxWidth: "none", height: "100dvh", maxHeight: "none", borderRadius: 0, border: "none" }
    : undefined;

  const botaoTopo = "h-11 rounded-full border-2 border-foreground bg-background hover:bg-muted font-body font-bold text-[14px] inline-flex items-center justify-center gap-1.5 transition-colors";

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogPortal>
          <DialogContent
            className={cn(
              "p-0 gap-0 overflow-hidden flex flex-col bg-background [&>button.absolute]:hidden",
              !isMobile && "max-w-[1040px] w-[94vw] h-[min(800px,88vh)] rounded-[28px] border-2 border-foreground shadow-[0_12px_0_hsl(var(--foreground))]",
            )}
            style={mobilePanelStyle}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => { if (historicoAberto) { e.preventDefault(); setHistoricoAberto(false); } }}
            aria-label="Cria IA"
          >
            {/* ── Topo ── */}
            <div
              className="relative shrink-0 flex items-center gap-2.5 px-3 md:px-5 pb-3 md:pt-3.5 border-b-2 border-border"
              style={isMobile ? { paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" } : undefined}
            >
              <AvatarCria size={isMobile ? 40 : 46} />
              <div className="flex-1 min-w-0">
                <p className="font-display font-extrabold text-[18px] md:text-[20px] leading-tight">Cria IA</p>
                <p className="text-[12px] md:text-[13px] text-muted-foreground font-body flex items-center gap-1.5 truncate">
                  <span className="h-2 w-2 rounded-full bg-[#01A652] shrink-0" />
                  <span className="truncate">{hasBrandContext ? "Já conhece sua marca" : "Pronta pra criar"}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setHistoricoAberto((v) => !v)} aria-expanded={historicoAberto}
                  aria-label="Histórico de conversas"
                  className={cn(botaoTopo, isMobile ? "w-11" : "px-3.5", historicoAberto && "bg-foreground text-background hover:bg-foreground")}>
                  <History className="h-[18px] w-[18px]" />
                  {!isMobile && "Histórico"}
                </button>
                <button type="button" onClick={novaConversa} aria-label="Nova conversa" className={cn(botaoTopo, isMobile ? "w-11" : "px-3.5")}>
                  <Plus className="h-[18px] w-[18px]" />
                  {!isMobile && "Nova conversa"}
                </button>
                {!isMobile && (
                  <>
                    <button type="button" onClick={() => startTour("cria-ia")} aria-label="Ver tutorial da Cria IA"
                      className="h-10 w-10 rounded-xl hover:bg-muted grid place-items-center text-muted-foreground">
                      <CircleHelp className="h-[18px] w-[18px]" />
                    </button>
                    <button type="button" onClick={() => setMinimized(true)} aria-label="Minimizar"
                      className="h-10 w-10 rounded-xl hover:bg-muted grid place-items-center text-muted-foreground">
                      <Minus className="h-[18px] w-[18px]" />
                    </button>
                  </>
                )}
                <button type="button" onClick={handleClose} aria-label="Fechar"
                  className="h-11 w-11 rounded-xl hover:bg-muted grid place-items-center text-foreground/80">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Histórico no computador: popup embaixo do botão. */}
              {historicoAberto && !isMobile && (
                <>
                  <button type="button" aria-label="Fechar histórico" className="fixed inset-0 z-10 cursor-default" onClick={() => setHistoricoAberto(false)} />
                  <div className="absolute right-4 md:right-5 top-[calc(100%-6px)] z-20 w-[400px] rounded-[22px] border-2 border-foreground bg-background shadow-[0_8px_0_hsl(var(--foreground))] overflow-hidden">
                    <ListaHistorico conversas={conversas} atual={conversaId} onAbrir={abrirConversa} />
                  </div>
                </>
              )}
            </div>

            {/* ── Conversa ── */}
            <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5 md:py-7">
              <div className="max-w-[780px] mx-auto">
                {!hasMessages && !loading ? (
                  <div data-tour="cria-ia-atalhos" className="pt-1 md:pt-5">
                    <p className="[font-family:'Grand_Hotel',cursive] text-[28px] md:text-[34px] text-[#D9480F] -rotate-2 origin-left leading-none">
                      oi{primeiroNome ? `, ${primeiroNome}` : ""}!
                    </p>
                    <h2 className="font-display font-extrabold text-[30px] md:text-[40px] leading-[1.05] mt-1">O que vamos criar hoje?</h2>
                    <p className="text-[14px] md:text-[16px] text-muted-foreground font-body mt-2 mb-5 md:mb-6 leading-relaxed">
                      {hasBrandContext
                        ? "Já li o seu brandbook, então tudo sai no seu tom. Escolhe um atalho ou escreve do seu jeito."
                        : "Escolhe um atalho ou escreve do seu jeito. Preenche o brandbook pra eu criar com a sua cara."}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-3">
                      {QUICK_ACTIONS.map((qa) => (
                        <button key={qa.label} type="button" onClick={() => void sendMessage(qa.build(ctx))} disabled={loading}
                          className="text-left rounded-[20px] border-2 border-foreground bg-card p-3.5 md:p-4 shadow-[0_4px_0_hsl(var(--foreground))] hover:-translate-y-0.5 transition-transform flex flex-col gap-2 disabled:opacity-50">
                          <span className="grid h-10 w-10 place-items-center rounded-[38%_62%_55%_45%/48%_42%_58%_52%]" style={{ background: qa.color }}>
                            <qa.Icon className="h-[19px] w-[19px]" style={{ color: qa.dark ? "#0A0A0A" : "#fff" }} />
                          </span>
                          <span className="font-display font-extrabold text-[15px] md:text-[17px] leading-tight">{qa.label}</span>
                          <span className="text-[12.5px] md:text-[13px] text-muted-foreground font-body leading-snug">{qa.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {messages.map((msg) =>
                      msg.role === "user" ? (
                        <div key={msg.id} className="flex justify-end">
                          <div className="max-w-[85%] md:max-w-[70%] rounded-[20px] rounded-br-md border-2 border-[#F4B79C] bg-[#FFE3D6] text-[#0A0A0A] px-4 py-2.5">
                            <p className="text-[14.5px] md:text-[15px] font-body whitespace-pre-line leading-relaxed">{msg.content}</p>
                          </div>
                        </div>
                      ) : (
                        <div key={msg.id} className="flex gap-2.5 md:gap-3 items-start">
                          <AvatarCria size={isMobile ? 30 : 36} className="mt-0.5" />
                          <div className="flex-1 min-w-0 space-y-3">
                            {msg.content && (
                              <p className="text-[14.5px] md:text-[15.5px] font-body leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(msg.content)) }} />
                            )}
                            {msg.ideias?.map((i, idx) => {
                              const salva = salvas.has(`${msg.id}:${idx}`);
                              return (
                                <div key={idx} className="rounded-[22px] border-2 border-foreground bg-card p-4 md:p-[18px] space-y-2.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-[#0A0A0A]" style={{ background: CORES_IDEIA[idx % CORES_IDEIA.length] }}>
                                      Ideia {idx + 1}
                                    </span>
                                    {i.formato && <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-muted text-foreground/80">{i.formato}</span>}
                                  </div>
                                  <p className="font-display font-extrabold text-[18px] md:text-[20px] leading-tight">{i.titulo}</p>
                                  {i.descricao && <p className="text-[14px] md:text-[14.5px] font-body text-foreground/80 leading-relaxed">{i.descricao}</p>}
                                  {i.texto_tela && (
                                    <div className="rounded-[14px] bg-muted/60 px-3.5 py-2.5">
                                      <span className="block text-[10.5px] font-bold tracking-wider text-muted-foreground">TEXTO NA TELA</span>
                                      <span className="text-[14px] font-body leading-snug">{i.texto_tela}</span>
                                    </div>
                                  )}
                                  <div className="flex gap-2 flex-wrap pt-0.5">
                                    <button type="button" onClick={() => void salvarIdeia(msg.id, idx, i)} disabled={salva || createIdea.isPending}
                                      className={cn("h-10 px-3.5 rounded-full border-2 border-foreground font-body font-bold text-[13.5px] text-white transition-colors",
                                        salva ? "bg-[#01A652] border-[#01A652]" : "bg-[#0A0A0A] hover:bg-[#2a2722]")}>
                                      {salva ? "Salva no banco de ideias" : "Salvar no banco de ideias"}
                                    </button>
                                    <button type="button" disabled={loading}
                                      onClick={() => void sendMessage(`Transforma a ideia "${i.titulo}" num roteiro de reels com gancho, desenvolvimento e chamada pra ação.`)}
                                      className="h-10 px-3.5 rounded-full border-2 border-border bg-background hover:border-foreground font-body font-bold text-[13.5px] disabled:opacity-50">
                                      Virar roteiro
                                    </button>
                                    <button type="button" onClick={() => copiar(textoDaIdeia(i))}
                                      className="h-10 px-3 rounded-full font-body font-semibold text-[13.5px] text-foreground/80 hover:bg-muted inline-flex items-center gap-1.5">
                                      <Copy className="h-3.5 w-3.5" /> Copiar
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {msg.id === ultimaIA?.id && !loading && !!msg.sugestoes?.length && (
                              <div>
                                <p className="text-[12.5px] font-body font-bold text-muted-foreground mb-2">Quer seguir por onde?</p>
                                <div className="flex gap-2 flex-wrap">
                                  {msg.sugestoes.map((s) => (
                                    <button key={s} type="button" onClick={() => void sendMessage(s)}
                                      className="h-10 px-3.5 rounded-full border-2 border-dashed border-foreground font-body font-semibold text-[13.5px] hover:bg-muted">
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                    {loading && (
                      <div className="flex gap-3 items-start">
                        <AvatarCria size={isMobile ? 30 : 36} />
                        <div className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-pulse" />
                          <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-pulse [animation-delay:0.15s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-pulse [animation-delay:0.3s]" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Escrever ── */}
            <div data-tour="cria-ia-input" className="shrink-0 border-t-2 border-border bg-background px-3 md:px-5 pt-2.5 md:pt-3"
              style={{ paddingBottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 10px)" : 16 }}>
              <div className="max-w-[780px] mx-auto space-y-2">
                {hasMessages && (
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
                    {QUICK_ACTIONS.map((qa) => (
                      <button key={qa.label} type="button" disabled={loading} onClick={() => void sendMessage(qa.build(ctx))}
                        className="shrink-0 h-8 px-3 rounded-full bg-muted hover:bg-muted/70 font-body font-semibold text-[12.5px] text-foreground/80 inline-flex items-center gap-1.5 disabled:opacity-50">
                        <span className="h-2 w-2 rounded-full" style={{ background: qa.color }} />
                        {qa.label}
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-[22px] border-2 border-foreground bg-card pl-4 pr-1.5 py-1.5">
                  <label htmlFor="cria-ia-msg" className="sr-only">Mensagem pra Cria IA</label>
                  <Textarea
                    id="cria-ia-msg"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage(input);
                      }
                    }}
                    placeholder="Me conta o que você precisa criar..."
                    disabled={loading}
                    rows={1}
                    className="flex-1 border-0 shadow-none focus-visible:ring-0 resize-none min-h-[44px] max-h-32 px-0 py-2.5 text-[16px] md:text-[15px] font-body bg-transparent"
                  />
                  <button type="submit" disabled={!input.trim() || loading} aria-label="Enviar"
                    className="h-11 w-11 shrink-0 rounded-2xl bg-[#EA4918] text-white grid place-items-center disabled:opacity-40 transition-opacity">
                    {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
                  </button>
                </form>
                {!isMobile && (
                  <p className="text-[12px] text-muted-foreground font-body text-center">Enter envia. Shift + Enter pula linha. As conversas ficam no Histórico.</p>
                )}
              </div>
            </div>

            {/* Histórico no celular: sobe de baixo. */}
            {historicoAberto && isMobile && (
              <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/45">
                <button type="button" aria-label="Fechar histórico" className="flex-1" onClick={() => setHistoricoAberto(false)} />
                <div className="rounded-t-[28px] border-t-2 border-foreground bg-background max-h-[80dvh] flex flex-col"
                  style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}>
                  <span aria-hidden className="self-center mt-2.5 mb-1 h-[5px] w-11 rounded-full bg-border" />
                  <ListaHistorico conversas={conversas} atual={conversaId} onAbrir={abrirConversa} />
                </div>
              </div>
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Minimizado: o rostinho da Cria no canto, com o contador de respostas novas. */}
      {showFab && (
        <button
          type="button"
          onClick={() => { setMinimized(false); setUnread(0); }}
          className="fixed right-6 z-50 h-14 w-14 rounded-full shadow-glow hover:shadow-glow-hover hover:scale-105 transition-all grid place-items-center md:bottom-6"
          style={isMobile ? { bottom: "calc(72px + env(safe-area-inset-bottom, 0px) + 12px)" } : undefined}
          aria-label="Abrir Cria IA"
        >
          <AvatarCria size={56} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-pink-500 border-2 border-background flex items-center justify-center text-[10px] font-display font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    </>
  );
}

function ListaHistorico({ conversas, atual, onAbrir }: {
  conversas: ConversaCria[]; atual: string | null; onAbrir: (c: ConversaCria) => void;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
        <span className="font-display font-extrabold text-[17px]">Suas últimas conversas</span>
        <span className="text-[12px] text-muted-foreground font-body">10 mais recentes</span>
      </div>
      {conversas.length === 0 ? (
        <p className="px-4 pb-5 pt-1 text-[13.5px] text-muted-foreground font-body">
          Ainda não tem conversa guardada. As próximas que você fizer aparecem aqui.
        </p>
      ) : (
        <div className="overflow-y-auto max-h-[470px] px-2 pb-2 flex flex-col gap-0.5">
          {conversas.map((c, n) => {
            const primeira = Array.isArray(c.mensagens) ? c.mensagens.find((m) => m.role === "assistant") : undefined;
            const previa = primeira?.ideias?.length
              ? `${primeira.ideias.length} ideia${primeira.ideias.length > 1 ? "s" : ""}: ${primeira.ideias.map((i) => i.titulo).join(", ")}`
              : (primeira?.content ?? "").replace(/\s+/g, " ");
            return (
              <button key={c.id} type="button" onClick={() => onAbrir(c)}
                className={cn("text-left rounded-2xl px-3 py-2.5 min-h-[52px] flex gap-3 items-center hover:bg-muted transition-colors", c.id === atual && "bg-muted")}>
                <span className="h-8 w-8 shrink-0 rounded-[10px]" style={{ background: CORES_IDEIA[n % CORES_IDEIA.length] }} />
                <span className="flex-1 min-w-0">
                  <span className="flex justify-between gap-2">
                    <span className="font-body font-bold text-[14px] truncate">{c.titulo}</span>
                    <span className="text-[12px] text-muted-foreground font-body shrink-0">{quandoFoi(c.updated_at)}</span>
                  </span>
                  {previa && <span className="block text-[12.5px] text-muted-foreground font-body truncate mt-0.5">{previa}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CalendarDays, Flame, Hash, Lightbulb, Loader2, Minus, PenLine, Send, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import DOMPurify from "dompurify";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

type QuickAction = {
  label: string;
  Icon: LucideIcon;
  /** Cor da marca do ícone do atalho. */
  color: string;
  /** Ícone escuro (usado no amarelo, onde branco teria baixo contraste). */
  dark?: boolean;
  build: (ctx: { niche: string; lastPostTitle: string; postsCount: number; ideasCount: number; weeklyGoal: number }) => string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Ideia de post",
    Icon: Lightbulb,
    color: "#FFCF03",
    dark: true,
    build: ({ niche }) => `Me dá 3 ideias de post pro meu nicho de ${niche || "criação de conteúdo"} pra essa semana.`,
  },
  {
    label: "Escrever legenda",
    Icon: PenLine,
    color: "#0061EE",
    build: ({ lastPostTitle, niche }) =>
      `Escreve uma legenda descontraída pra um reels sobre "${lastPostTitle || `o meu nicho de ${niche || "criação"}`}".`,
  },
  {
    label: "Sugerir hashtags",
    Icon: Hash,
    color: "#01A652",
    build: ({ niche }) => `Sugere 15 hashtags pro meu nicho de ${niche || "criação de conteúdo"} no Instagram.`,
  },
  {
    label: "Analisar perfil",
    Icon: BarChart3,
    color: "#F27EB5",
    build: ({ postsCount, ideasCount, weeklyGoal }) =>
      `Analisa minha consistência: tenho ${postsCount} posts publicados, ${ideasCount} ideias e minha meta é ${weeklyGoal}/semana. O que você sugere?`,
  },
  {
    label: "Planejar semana",
    Icon: CalendarDays,
    color: "#7C90F0",
    build: ({ niche, weeklyGoal }) =>
      `Me ajuda a planejar minha semana de conteúdo no nicho de ${niche || "criação"} com ${weeklyGoal} posts.`,
  },
  {
    label: "Trends do momento",
    Icon: Flame,
    color: "#EA4918",
    build: ({ niche }) =>
      `Busque as 5 trends mais virais agora no Instagram/TikTok pro nicho de ${niche || "lifestyle"} no Brasil e me dê ideias de como adaptar cada uma pro meu conteúdo.`,
  },
];

/** A CriaTura do Cria (a lâmpada, sticker oficial da marca), usada como avatar
    da IA no chat. PNG oficial em vez de desenho aproximado. */
function CriaCreature({ className, online = false }: { className?: string; online?: boolean }) {
  return (
    <span className={cn("relative inline-block", className)}>
      <img src="/stickers/criatura-lampada.png" alt="Cria" draggable={false} className="w-full h-full object-contain" />
      {online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-[#01A652] border-2 border-background" />}
    </span>
  );
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdown(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "• $1")
    .replace(/^\d+\. (.+)$/gm, (_match, content) => `• ${content}`)
    .replace(/\n/g, "<br />");
}

export function CriaAIPanel() {
  const { open, closeCria, consumeInitialPrompt } = useCriaAI();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { posts } = usePosts();
  const { ideas } = useIdeas();
  const { brandContext, hasBrandContext } = useBrandContext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const greeting = profile?.name ? `Oi, ${profile.name.split(" ")[0]}!` : "Oi!";

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
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: uid(), role: "user", content: trimmed, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const recentTitles = posts
        .slice(-5)
        .map((p) => p.title)
        .filter(Boolean);

      const raw = await callAIContextBuilder({
        userId: user?.id,
        operation: "cria-chat",
        data: {
          mensagem: trimmed,
          nome: profile?.name,
          nicho: profile?.niche,
          plataformas: profile?.platforms ?? [],
          meta_semanal: profile?.weekly_goal,
          ultimos_posts: recentTitles,
          historico: messages
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content })),
          brandContext,
        },
      });

      const replyText =
        typeof raw === "string" ? raw.replace(/```\w*\n?|\n?```/g, "").trim() : raw ? String(raw) : "";

      const reply: Message = {
        id: uid(),
        role: "assistant",
        content: replyText || "Não consegui gerar uma resposta agora. Tenta de novo daqui a pouco.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, reply]);
      if (minimized) setUnread((u) => u + 1);
    } catch (e) {
      console.error("Cria chat failed", e);
      toast.error("Não consegui responder agora. Tenta de novo.");
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: "Algo deu errado na minha cabeça aqui 😅 Tenta de novo daqui a pouco?",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const pending = consumeInitialPrompt();
    if (pending) {
      sendMessage(pending);
    }
  }, [open, consumeInitialPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.build(ctx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleClose = () => {
    closeCria();
    setMinimized(false);
  };

  const handleMinimize = () => {
    setMinimized(true);
  };

  const handleRestore = () => {
    setMinimized(false);
    setUnread(0);
  };

  const dialogOpen = open && !minimized;
  const showFab = open && minimized;
  const hasMessages = messages.length > 0;

  // MOBILE: o painel precisa abrir DENTRO da tela, respeitando a área segura do
  // topo (notch/status bar) e sem estourar por cima. O DialogContent base usa
  // top-4 fixo (ignora o notch) + altura fixa de 600px, o que corta o topo em
  // telas curtas. Aqui, só no celular, ancoramos abaixo da safe-area e deixamos
  // a altura preencher o espaço disponível (com rolagem interna no chat e o input
  // fixo embaixo). Estilo inline vence as classes, então também neutralizamos o
  // translate-y do desktop (evita empurrar o painel pra cima entre 640-767px).
  // No desktop, style fica undefined e o comportamento centralizado atual segue igual.
  const mobilePanelStyle: React.CSSProperties | undefined = isMobile
    ? {
        top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
        height:
          "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 1.5rem)",
        maxHeight: "85dvh",
        transform: "translate(-50%, 0)",
      }
    : undefined;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogPortal>
          <DialogContent
            className="max-w-md p-0 rounded-2xl overflow-hidden gap-0 h-[600px] flex flex-col [&>button.absolute]:hidden"
            style={mobilePanelStyle}
            onInteractOutside={(e) => e.preventDefault()}
          >
            {/* Top controls */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
              <button
                type="button"
                onClick={handleMinimize}
                className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
                aria-label="Minimizar"
              >
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors text-muted-foreground"
                aria-label="Fechar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Chat / empty state */}
            <div
              ref={scrollAreaRef}
              className="flex-1 overflow-y-auto px-5 pt-5 pb-2 space-y-4 bg-muted/15"
            >
              {!hasMessages && !loading ? (
                <div className="relative flex flex-col items-start pt-4 pb-2">
                  {/* Formas orgânicas suaves da marca, no fundo. */}
                  <span aria-hidden className="pointer-events-none absolute -top-3 -right-4 h-32 w-32 rounded-[42%_58%_55%_45%/48%_42%_58%_52%] bg-[#EA4918] opacity-[0.10] blur-[2px]" />
                  <span aria-hidden className="pointer-events-none absolute top-40 -left-6 h-24 w-24 rounded-full bg-[#0061EE] opacity-[0.08] blur-[2px]" />
                  <span aria-hidden className="pointer-events-none absolute top-24 right-1 h-16 w-16 rounded-full bg-[#F27EB5] opacity-[0.10] blur-[2px]" />

                  <CriaCreature className="h-14 w-14 mb-3.5" online />
                  <h2 className="relative z-[1] text-2xl font-display font-extrabold text-foreground leading-tight">{greeting}</h2>
                  <p className="relative z-[1] text-base font-display font-bold text-foreground mt-1">Bora criar junto?</p>
                  <p className="relative z-[1] text-sm text-muted-foreground font-body mt-1.5 leading-relaxed">
                    {hasBrandContext
                      ? <>Já li o seu <b className="text-[#EA4918] font-extrabold">brandbook</b>, então tudo que eu escrever sai no seu tom, com as suas cores e a sua cara.</>
                      : "Preenche o seu brandbook pra eu conhecer a sua marca e criar com a sua cara. Por enquanto, já te ajudo com ideias gerais."}
                  </p>
                  <div className="relative z-[1] flex flex-wrap gap-2 pt-4">
                    {QUICK_ACTIONS.map((qa) => (
                      <button
                        key={qa.label}
                        type="button"
                        onClick={() => handleQuickAction(qa)}
                        disabled={loading}
                        style={{ borderColor: `${qa.color}44` }}
                        className="group inline-flex items-center gap-2 rounded-full border bg-card pl-2 pr-3.5 py-1.5 text-[13px] font-display font-bold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="grid h-[26px] w-[26px] place-items-center rounded-lg" style={{ background: qa.color }}>
                          <qa.Icon className="h-[15px] w-[15px]" style={{ color: qa.dark ? "#0A0A0A" : "#fff" }} />
                        </span>
                        {qa.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) =>
                    msg.role === "assistant" ? (
                      <div key={msg.id} className="flex gap-2 items-start">
                        <CriaCreature className="h-7 w-7 shrink-0 mt-0.5" />
                        <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] shadow-warm-sm">
                          <p
                            className="text-sm font-body text-foreground leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(msg.content)) }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div key={msg.id} className="flex justify-end">
                        <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-md px-4 py-3 max-w-[85%]">
                          <p className="text-sm font-body text-foreground whitespace-pre-line leading-relaxed">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                  {loading && (
                    <div className="flex gap-2 items-start">
                      <CriaCreature className="h-7 w-7 shrink-0 mt-0.5" />
                      <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:0.15s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:0.3s]" />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border bg-background px-4 py-3">
              <form onSubmit={handleSubmit} className="relative">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder="Me conta o que você precisa criar..."
                  disabled={loading}
                  rows={1}
                  className="rounded-2xl border-border ring-1 ring-border/50 pr-12 resize-none min-h-[44px] max-h-32 text-sm font-body"
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="hero"
                  disabled={!input.trim() || loading}
                  className="absolute right-1.5 bottom-1.5 h-9 w-9 rounded-xl"
                  aria-label="Enviar"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Floating action button when minimized */}
      {showFab && (
        <button
          type="button"
          onClick={handleRestore}
          className="fixed right-6 z-50 w-14 h-14 rounded-full overflow-hidden shadow-glow hover:shadow-glow-hover hover:scale-105 transition-all flex items-center justify-center md:bottom-6"
          style={isMobile ? { bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 12px)' } : undefined}
          aria-label="Abrir cria"
        >
          <CriaCreature className="h-full w-full" />
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

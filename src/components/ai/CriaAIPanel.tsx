import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Minus, Send, Sparkles, X } from "lucide-react";
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
  emoji: string;
  classes: string;
  build: (ctx: { niche: string; lastPostTitle: string; postsCount: number; ideasCount: number; weeklyGoal: number }) => string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Ideia de post",
    emoji: "💡",
    classes: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    build: ({ niche }) => `Me dá 3 ideias de post pro meu nicho de ${niche || "criação de conteúdo"} pra essa semana.`,
  },
  {
    label: "Escrever legenda",
    emoji: "✍️",
    classes: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
    build: ({ lastPostTitle, niche }) =>
      `Escreve uma legenda descontraída pra um reels sobre "${lastPostTitle || `o meu nicho de ${niche || "criação"}`}".`,
  },
  {
    label: "Sugerir hashtags",
    emoji: "#️⃣",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    build: ({ niche }) => `Sugere 15 hashtags pro meu nicho de ${niche || "criação de conteúdo"} no Instagram.`,
  },
  {
    label: "Analisar perfil",
    emoji: "📊",
    classes: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100",
    build: ({ postsCount, ideasCount, weeklyGoal }) =>
      `Analisa minha consistência: tenho ${postsCount} posts publicados, ${ideasCount} ideias e minha meta é ${weeklyGoal}/semana. O que você sugere?`,
  },
  {
    label: "Planejar semana",
    emoji: "📅",
    classes: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
    build: ({ niche, weeklyGoal }) =>
      `Me ajuda a planejar minha semana de conteúdo no nicho de ${niche || "criação"} com ${weeklyGoal} posts.`,
  },
  {
    label: "Trends do momento",
    emoji: "🔥",
    classes: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
    build: ({ niche }) =>
      `Busque as 5 trends mais virais agora no Instagram/TikTok pro nicho de ${niche || "lifestyle"} no Brasil e me dê ideias de como adaptar cada uma pro meu conteúdo.`,
  },
];

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

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogPortal>
          <DialogContent
            className="max-w-md p-0 rounded-2xl overflow-hidden gap-0 h-[600px] flex flex-col [&>button.absolute]:hidden"
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
                <div className="flex flex-col items-start pt-4 pb-2 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0A0D12] to-[#1a1d22] flex items-center justify-center shadow-lg">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl text-muted-foreground font-medium font-display">{greeting}</p>
                    <p className="text-lg font-display font-medium text-foreground">Como posso ajudar?</p>
                    <p className="text-sm text-muted-foreground font-body">
                      {hasBrandContext
                        ? "Já li seu Brandbook 💜 Tudo que eu gerar vai seguir seu tom de voz e identidade."
                        : "Preencha seu Brandbook pra eu conhecer sua marca e gerar conteúdo personalizado. Por enquanto, posso te ajudar com ideias gerais!"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {QUICK_ACTIONS.map((qa) => (
                      <button
                        key={qa.label}
                        type="button"
                        onClick={() => handleQuickAction(qa)}
                        disabled={loading}
                        className={cn(
                          "text-xs font-body font-medium px-3 py-1.5 rounded-full border transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed",
                          qa.classes
                        )}
                      >
                        <span aria-hidden="true" className="mr-1">{qa.emoji}</span>
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
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shrink-0">
                          <Sparkles className="h-3.5 w-3.5 text-white" />
                        </div>
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
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shrink-0">
                        <Sparkles className="h-3.5 w-3.5 text-white" />
                      </div>
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
                  placeholder="Pergunte qualquer coisa..."
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
          className="fixed right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-purple-600 shadow-glow hover:shadow-glow-hover hover:scale-105 transition-all flex items-center justify-center md:bottom-6"
          style={isMobile ? { bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 12px)' } : undefined}
          aria-label="Abrir cria"
        >
          <Sparkles className="h-6 w-6 text-white" strokeWidth={1.75} />
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

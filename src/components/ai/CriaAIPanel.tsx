import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import { useIdeas } from "@/hooks/useIdeas";
import { useCriaAI } from "@/contexts/CriaAIContext";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

type QuickAction = {
  label: string;
  emoji: string;
  build: (ctx: { niche: string; lastPostTitle: string; postsCount: number; ideasCount: number; weeklyGoal: number }) => string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Me dá uma ideia",
    emoji: "💡",
    build: ({ niche }) => `Me dá 3 ideias de post pro meu nicho de ${niche || "criação de conteúdo"} pra essa semana.`,
  },
  {
    label: "Escreve uma legenda",
    emoji: "✍️",
    build: ({ lastPostTitle, niche }) =>
      `Escreve uma legenda descontraída pra um reels sobre "${lastPostTitle || `o meu nicho de ${niche || "criação"}`}".`,
  },
  {
    label: "Sugere hashtags",
    emoji: "#️⃣",
    build: ({ niche }) => `Sugere 15 hashtags pro meu nicho de ${niche || "criação de conteúdo"} no Instagram.`,
  },
  {
    label: "Analisa meu perfil",
    emoji: "📊",
    build: ({ postsCount, ideasCount, weeklyGoal }) =>
      `Analisa minha consistência: tenho ${postsCount} posts publicados, ${ideasCount} ideias e minha meta é ${weeklyGoal}/semana. O que você sugere?`,
  },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Oi! Eu sou a Cria 💜 sua assistente criativa. Me pergunte o que quiser: ideias, legendas, hashtags, ou análises. Posso usar seu nicho e seus últimos posts pra te ajudar.",
  timestamp: Date.now(),
};

export function CriaAIPanel() {
  const { open, closeCria, consumeInitialPrompt } = useCriaAI();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { posts } = usePosts();
  const { ideas } = useIdeas();

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
            .filter((m) => m.id !== "welcome")
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content })),
        },
      });

      const replyText =
        typeof raw === "string"
          ? raw.replace(/```\w*\n?|\n?```/g, "").trim()
          : raw
          ? String(raw)
          : "";

      const reply: Message = {
        id: uid(),
        role: "assistant",
        content: replyText || "Não consegui gerar uma resposta agora. Tenta de novo daqui a pouco.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, reply]);
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
    const prompt = action.build(ctx);
    sendMessage(prompt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? null : closeCria())}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-4 py-3 border-b border-border space-y-0">
          <SheetTitle className="flex items-center gap-2.5 text-left">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-display font-bold text-foreground leading-tight">Cria IA</span>
              <span className="text-[11px] font-body text-muted-foreground font-normal">Sua assistente criativa</span>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div
          ref={scrollAreaRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-muted/20"
        >
          {messages.map((msg) =>
            msg.role === "assistant" ? (
              <div key={msg.id} className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] shadow-warm-sm">
                  <p className="text-sm font-body text-foreground whitespace-pre-line leading-relaxed">
                    {msg.content}
                  </p>
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
        </div>

        <div className="border-t border-border bg-background">
          <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                type="button"
                onClick={() => handleQuickAction(qa)}
                disabled={loading}
                className={cn(
                  "text-xs font-body px-2.5 py-1 rounded-full border border-border bg-card hover:border-primary/30 hover:bg-accent transition-colors",
                  loading && "opacity-50 cursor-not-allowed"
                )}
              >
                <span aria-hidden="true" className="mr-1">{qa.emoji}</span>
                {qa.label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="px-4 pb-4 flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte qualquer coisa..."
              disabled={loading}
              className="rounded-full h-11"
              autoFocus
            />
            <Button
              type="submit"
              variant="hero"
              size="icon"
              disabled={!input.trim() || loading}
              aria-label="Enviar"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

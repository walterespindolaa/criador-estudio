import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket, X, Check, ArrowRight,
  Lightbulb, Instagram, Palette, Send, Link as LinkIcon, LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useIdeas } from "@/hooks/useIdeas";
import { usePosts } from "@/hooks/usePosts";
import { useMoodboard } from "@/hooks/useMoodboard";

type Step = {
  id: string;
  label: string;
  note?: string;
  icon: LucideIcon;
  to: string;
  done: boolean;
  /** quando não há dado pra derivar, marca como concluído ao clicar */
  markOnClick?: boolean;
};

export function FirstStepsPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { ideas } = useIdeas({ limit: 5 });
  const { posts } = usePosts({ limit: 30 });
  const { entries } = useMoodboard();

  const dismissKey = user ? `cria-firststeps-dismissed-${user.id}` : "cria-firststeps-dismissed";
  const clickedKey = user ? `cria-firststeps-clicked-${user.id}` : "cria-firststeps-clicked";

  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });
  const [clicked, setClicked] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(clickedKey) || "[]"); } catch { return []; }
  });

  const hasPublished = useMemo(() => posts.some((p) => p.status === "publicado"), [posts]);

  const steps: Step[] = [
    { id: "ideas", label: "Montar minha primeira semana", icon: Lightbulb, to: "/app/ideias", done: ideas.length > 0 },
    { id: "instagram", label: "Conectar meu Instagram", icon: Instagram, to: "/app/configuracoes", done: !!profile?.instagram_handle },
    { id: "moodboard", label: "Preencher meu moodboard", note: "a Cria IA aprende seu estilo", icon: Palette, to: "/app/brandbook", done: (entries?.length ?? 0) > 0 },
    { id: "post", label: "Publicar meu 1º post", icon: Send, to: "/app/criando", done: hasPublished },
    { id: "bio", label: "Montar meu link in bio", icon: LinkIcon, to: "/app/linkinbio", done: clicked.includes("bio"), markOnClick: true },
    { id: "modulos", label: "Explorar os módulos do Cria", icon: LayoutGrid, to: "/app/modulos", done: clicked.includes("modulos"), markOnClick: true },
  ];

  const total = steps.length;
  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / total) * 100);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey, "1"); } catch { /* noop */ }
  };

  const handleClick = (step: Step) => {
    if (step.markOnClick && !clicked.includes(step.id)) {
      const next = [...clicked, step.id];
      setClicked(next);
      try { localStorage.setItem(clickedKey, JSON.stringify(next)); } catch { /* noop */ }
    }
    navigate(step.to);
  };

  if (dismissed || completed >= total) return null;

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="bg-card border border-primary/15 rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-warm)] mb-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Rocket className="h-4.5 w-4.5 text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-display font-bold text-foreground">Primeiros passos no Cria</h3>
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                {completed} de {total} concluídos · destrave todo o potencial
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            aria-label="Dispensar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-1.5 rounded-full bg-muted mt-3 mb-4 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {steps.map((s) => (
            <button
              key={s.id}
              onClick={() => handleClick(s)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all group",
                s.done
                  ? "border-border bg-muted/40 cursor-default"
                  : "border-border hover:border-primary/30 hover:bg-primary/[0.03]"
              )}
            >
              {s.done ? (
                <Check className="h-4 w-4 text-emerald-500 shrink-0" strokeWidth={2.5} />
              ) : (
                <s.icon className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn("text-sm font-body block truncate", s.done ? "text-muted-foreground line-through" : "text-foreground")}>
                  {s.label}
                </span>
                {s.note && !s.done && (
                  <span className="text-[11px] text-muted-foreground/80 font-body">{s.note}</span>
                )}
              </span>
              {!s.done && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground/60 group-hover:translate-x-0.5 transition-all shrink-0" />
              )}
            </button>
          ))}
        </div>
      </motion.section>
    </AnimatePresence>
  );
}

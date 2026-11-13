import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket, X, Check, ArrowRight, Loader2, Clapperboard,
  Lightbulb, Instagram, Palette, Send, Link as LinkIcon, Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts } from "@/hooks/usePosts";
import { useMoodboard } from "@/hooks/useMoodboard";
import { useSocialConnection } from "@/hooks/useSocialInsights";
import { useBioLinks } from "@/hooks/useBioLinks";
import { useGoals } from "@/hooks/useGoals";
import { useIdeas } from "@/hooks/useIdeas";
import { TOTAL_PERGUNTAS } from "@/lib/brandbook-perguntas";
import { toast } from "sonner";

type Step = {
  id: string;
  label: string;
  note?: string;
  icon: LucideIcon;
  to: string;
  done: boolean;
  /** Selo da coleção que o onboarding v3 promete (002 e 003). */
  selo?: string;
  /** quando não há dado pra derivar, marca como concluído ao clicar */
};

export function FirstStepsPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { posts } = usePosts({ limit: 30 });
  const { entries } = useMoodboard();
  // Conexão REAL do Instagram (OAuth), não o @ digitado no perfil. Antes o passo
  // riscava só por ter texto no campo do @, então a pessoa achava que já estava
  // conectada e ficava sem entender por que os insights não vinham.
  const { data: conexaoInstagram } = useSocialConnection();
  const { links: bioLinks } = useBioLinks();
  const { structuredGoals } = useGoals();
  const { ideas: ideias, promoteToPost } = useIdeas({ limit: 8 });

  const dismissKey = user ? `cria-firststeps-dismissed-${user.id}` : "cria-firststeps-dismissed";

  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });

  const hasPublished = useMemo(() => posts.some((p) => p.status === "publicado"), [posts]);

  /* PROGRESSO DE VERDADE (onboarding v2, 23/09/2026). "Montar minha primeira
     semana" nascia concluído (o onboarding cria as ideias) e link na bio e
     metas contavam como feitos só por clicar. Cada item agora mede um dado
     real: tem post criado? tem botão na bio? tem meta cadastrada? */
  /* BRANDBOOK COMEÇADO, NÃO "FEITO" (24/10/2026). O onboarding agora já
     preenche parte do brandbook (a fala da pessoa, tom, objetivos e temas).
     Se bastasse uma resposta, o item nasceria riscado. Conta como feito com
     3/4 das perguntas; até lá mostra quanto falta. */
  const respondidas = (entries ?? []).filter((e) => (e.answer ?? "").trim().length > 0).length;
  const brandbookFeito = respondidas >= Math.ceil(TOTAL_PERGUNTAS * 0.75);

  const steps: Step[] = [
    /* SELO 001 (onboarding v3): a tela final do onboarding entrega o 001 pela
       primeira ideia. Ele aparece aqui já ganho, pra lista começar andando. */
    { id: "ideia", label: "Guardar minha 1ª ideia", icon: Lightbulb, to: "/app/ideias", done: ideias.length > 0, selo: "001" },
    { id: "instagram", label: "Conectar meu Instagram", note: "conta profissional, pra ver seus números", icon: Instagram, to: "/app/insights", done: !!conexaoInstagram },
    { id: "post", label: "Criar meu 1º post", note: "a partir de uma das suas ideias", icon: Lightbulb, to: "/app/ideias", done: posts.length > 0 },
    { id: "moodboard", label: "Completar meu Brandbook", note: `${respondidas} de ${TOTAL_PERGUNTAS} respondidas · a Cria IA escreve com a sua cara`, icon: Palette, to: "/app/brandbook", done: brandbookFeito },
    { id: "publicado", label: "Publicar meu 1º post", icon: Send, to: "/app/criando", done: hasPublished, selo: "002" },
    { id: "bio", label: "Montar meu link na bio", icon: LinkIcon, to: "/app/linkinbio", done: bioLinks.length > 0, selo: "003" },
    { id: "metas", label: "Definir metas de crescimento", note: "seguidores, alcance, vendas (a de posts você já tem)", icon: Target, to: "/app/metas", done: structuredGoals.length > 0 },
  ];

  const total = steps.length;
  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / total) * 100);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey, "1"); } catch { /* noop */ }
  };

  const handleClick = (step: Step) => { navigate(step.to); };

  /* UM PRIMEIRO PASSO ÓBVIO (Walter, 13/11/2026). Dos criadores que terminavam
     o onboarding, 6 em 10 saíam sem abrir nenhuma ferramenta: caíam numa lista
     de 7 itens e tinham que decidir sozinhos por onde começar. Enquanto não
     existe post, a ideia que a própria pessoa escreveu no onboarding aparece em
     destaque com um botão só. A mais antiga da lista é a dela (as da Cria IA
     entram depois). */
  const ideiaDaVez = posts.length === 0
    ? [...ideias].reverse().find((i) => !i.promoted_to_post_id) ?? null
    : null;
  const virarPost = async () => {
    if (!ideiaDaVez || promoteToPost.isPending) return;
    try {
      const novo = await promoteToPost.mutateAsync({
        ideaId: ideiaDaVez.id,
        post: { title: ideiaDaVez.title, platform: ideiaDaVez.platform || "instagram", format: "reels", pillar_id: ideiaDaVez.pillar_id, status: "ideia" },
      });
      navigate(`/app/criando?post=${novo.id}`);
    } catch {
      toast.error("Não consegui criar o post. Tenta de novo?");
    }
  };

  if (dismissed || completed >= total) return null;

  return (
    <AnimatePresence>
      <motion.section
        data-tour="dash-primeiros-passos"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="bg-card border border-primary/15 rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-warm)] mb-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Rocket className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} />
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

        {ideiaDaVez && (
          <div className="mb-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-3.5 sm:flex sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-body font-bold uppercase tracking-wider text-primary">Comece por aqui</p>
              <p className="mt-1 text-[15px] font-display font-bold leading-snug text-foreground line-clamp-2">“{ideiaDaVez.title}”</p>
              <p className="mt-1 text-[12.5px] font-body text-muted-foreground">Sua ideia já está guardada. Um toque e ela vira post, com gancho, roteiro e data pra você preencher.</p>
            </div>
            <div className="mt-3 flex flex-col gap-1.5 sm:mt-0 sm:shrink-0 sm:items-end">
              <button type="button" onClick={virarPost} disabled={promoteToPost.isPending}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-body font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto">
                {promoteToPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                Transformar em post
              </button>
              <button type="button" onClick={() => navigate("/app/ideias")} className="h-8 text-xs font-body font-semibold text-muted-foreground hover:text-foreground">
                Escolher outra ideia
              </button>
            </div>
          </div>
        )}

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
              {/* SELOS (onboarding v3): o fim do onboarding mostra o 001 e
                  diz que o 002 e o 003 estão aqui. */}
              {s.selo && (
                <span className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-display font-bold tracking-wide",
                  s.done ? "bg-[#EA4918] text-[#0A0A0A]" : "border border-dashed border-muted-foreground/40 text-muted-foreground",
                )}>
                  {s.done ? `selo ${s.selo}` : `vale selo ${s.selo}`}
                </span>
              )}
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

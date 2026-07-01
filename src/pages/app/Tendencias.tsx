import { motion } from "framer-motion";
import { TrendingUp, Loader2, Wand2, Sparkles, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { CopyButton } from "@/components/shared/CopyButton";
import { useCriaAI } from "@/contexts/CriaAIContext";
import { useProfile } from "@/hooks/useProfile";
import { useTrends, type Trend, type TrendKind } from "@/hooks/useTrends";

const KIND: Record<TrendKind, { label: string; chipBg: string; chipFg: string }> = {
  formato: { label: "Formato em alta", chipBg: "#EEEDFE", chipFg: "#3C3489" },
  tema: { label: "Tema quente", chipBg: "#FAEEDA", chipFg: "#854F0B" },
  gancho: { label: "Gancho", chipBg: "#E1F5EE", chipFg: "#085041" },
  data: { label: "Data", chipBg: "#FBEAF0", chipFg: "#72243E" },
};

export default function Tendencias() {
  const { profile } = useProfile();
  const { openCria } = useCriaAI();
  const isAdmin = profile?.role === "admin";
  const { data: trends = [], isLoading } = useTrends();

  const gerarIdeia = (t: Trend) => {
    openCria(`Quero ideias de conteúdo pra minha marca sobre esta tendência: "${t.title}"${t.description ? ` — ${t.description}` : ""}. Me dá 3 ideias prontas (gancho + formato), no meu tom e nicho, com uma legenda curta em cada.`);
  };

  const lastUpdated = trends[0]?.created_at ? new Date(trends[0].created_at) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-sm shrink-0">
          <TrendingUp className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Tendências</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5 flex items-center gap-1.5">
            {lastUpdated ? (
              <><Globe className="h-3.5 w-3.5 text-primary" /> Pesquisado na web · atualizado em {lastUpdated.toLocaleDateString("pt-BR")}</>
            ) : "O que está bombando pra você usar nos seus conteúdos."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center"><Loader2 className="h-6 w-6 text-primary mx-auto animate-spin" /></div>
      ) : trends.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl py-16 px-6 text-center">
          <TrendingUp className="h-7 w-7 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-body text-foreground font-medium">Banco de tendências ainda não atualizado</p>
          <p className="text-xs font-body text-muted-foreground mt-1">{isAdmin ? "Gere a primeira leva pelo Painel Admin → Banco de Tendências." : "Em breve a curadoria do CRIA traz as novidades aqui."}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trends.map((t) => {
              const k = KIND[t.kind] ?? KIND.tema;
              return (
                <div key={t.id} className="bg-card border border-border rounded-xl p-4 flex flex-col">
                  <span className="text-[11px] font-body px-2 py-0.5 rounded-full self-start" style={{ background: k.chipBg, color: k.chipFg }}>{k.label}</span>
                  <p className="text-[15px] font-body font-semibold text-foreground mt-2 leading-snug">{t.title}</p>
                  {t.description && <p className="text-[13px] font-body text-muted-foreground mt-1.5 leading-relaxed">{t.description}</p>}
                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border/60">
                    <button onClick={() => gerarIdeia(t)} className="text-[12px] font-medium text-primary flex items-center gap-1 hover:underline">
                      <Wand2 className="h-3.5 w-3.5" /> Gerar ideia
                    </button>
                    <CopyButton text={`${t.title}${t.description ? ` — ${t.description}` : ""}`} className="ml-auto" />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/15 px-4 py-3">
            <Wand2 className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs font-body text-foreground/80">
              O <Link to="/app/autopilot" className="text-primary font-medium">Cria Plano</Link> usa esse banco como contexto ao montar seu cronograma.
            </p>
            <Sparkles className="h-3.5 w-3.5 text-primary/60 ml-auto shrink-0" />
          </div>
        </>
      )}
    </motion.div>
  );
}

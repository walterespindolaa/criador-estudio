import { motion } from "framer-motion";
import { GraduationCap, Sparkles, TrendingUp, Video, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

type Course = {
  id: string;
  icon: LucideIcon;
  gradient: string;
  title: string;
  subtitle: string;
  topics: string[];
};

const COURSES: Course[] = [
  {
    id: "roteirizar",
    icon: Video,
    gradient: "from-rose-500 to-pink-500",
    title: "Roteirizar para Viralizar",
    subtitle: "Do zero ao roteiro que prende atenção",
    topics: [
      "Como estruturar o gancho dos primeiros 3 segundos",
      "Frameworks de roteiro para Reels e Shorts",
      "Storytelling para criadores iniciantes",
      "Edição básica que valoriza o conteúdo",
      "Análise de referências virais",
    ],
  },
  {
    id: "crescimento",
    icon: TrendingUp,
    gradient: "from-violet-500 to-purple-600",
    title: "Crescimento Orgânico",
    subtitle: "Estratégias reais para ganhar seguidores",
    topics: [
      "Como o algoritmo do Instagram funciona em 2025",
      "Frequência ideal de postagem por plataforma",
      "Como usar hashtags de forma inteligente",
      "Colaborações e parcerias estratégicas",
      "Análise de métricas que realmente importam",
    ],
  },
  {
    id: "ia",
    icon: Sparkles,
    gradient: "from-amber-500 to-orange-500",
    title: "IA para Criadores",
    subtitle: "Use inteligência artificial no seu fluxo",
    topics: [
      "Gerando ideias com prompts eficientes",
      "Roteiros assistidos por IA",
      "Legendas e CTAs com IA",
      "Criando thumbnails e capas com IA",
      "Automatizando partes da produção",
    ],
  },
];

const Aprender = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 md:pb-0">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-8 md:hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-sm shrink-0">
            <GraduationCap className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Aprender Mais</h1>
            <p className="text-muted-foreground font-body mt-0.5 text-sm">
              Cursos e materiais bônus para acelerar seu crescimento.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {COURSES.map((course) => {
            const Icon = course.icon;
            return (
              <div
                key={course.id}
                className="max-w-sm mx-auto w-full bg-card rounded-2xl border border-border shadow-warm p-8 text-center"
              >
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${course.gradient} flex items-center justify-center mx-auto mb-5 shadow-sm`}
                >
                  <Icon className="h-8 w-8 text-white" strokeWidth={1.75} />
                </div>

                <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-200 text-xs font-medium mb-4">
                  Em breve · Exclusivo
                </span>

                <h2 className="text-xl font-display font-bold text-foreground mb-1">
                  {course.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-5">{course.subtitle}</p>

                <div className="bg-muted/40 rounded-xl p-4 mb-6 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
                    O que você vai aprender
                  </p>
                  <ul className="space-y-2">
                    {course.topics.map((topic) => (
                      <li key={topic} className="flex items-start gap-2">
                        <Sparkles
                          className="h-3 w-3 text-amber-500 mt-1 shrink-0"
                          strokeWidth={2}
                        />
                        <span className="text-sm text-foreground/80 leading-relaxed">
                          {topic}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                  Você será notificado quando estiver disponível.
                </p>

                <Button variant="ghost" size="sm" onClick={() => navigate("/app")}>
                  → Voltar ao Dashboard
                </Button>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default Aprender;

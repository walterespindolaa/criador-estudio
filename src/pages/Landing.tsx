import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Lightbulb, Kanban, BarChart3, BookOpen, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: Lightbulb,
    title: "Capture suas ideias",
    description: "Nunca mais perca uma ideia. Anote no momento da inspiração e organize depois.",
  },
  {
    icon: Kanban,
    title: "Pipeline criativo",
    description: "Do rascunho ao publicado — visualize tudo no seu kanban pessoal.",
  },
  {
    icon: BarChart3,
    title: "Acompanhe sua evolução",
    description: "Histórico completo dos seus conteúdos. Veja o quanto você já cresceu.",
  },
  {
    icon: BookOpen,
    title: "Biblioteca de apoio",
    description: "Hooks, prompts e referências prontas para destravar sua criatividade.",
  },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <h1 className="text-2xl font-display font-extrabold text-foreground">Criadores</h1>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => navigate("/login")}>Entrar</Button>
          <Button variant="hero" onClick={() => navigate("/signup")}>Começar grátis</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-sm font-body font-medium text-primary tracking-wider uppercase mb-4">
            Seu segundo cérebro criativo
          </p>
          <h2 className="text-5xl md:text-6xl font-display font-extrabold text-foreground leading-tight tracking-tight mb-6">
            Crie. Organize.{" "}
            <span className="text-primary">Apareça.</span>
          </h2>
          <p className="text-lg text-muted-foreground font-body max-w-2xl mx-auto mb-10 leading-relaxed">
            De ideia solta a conteúdo publicado — sem ansiedade, sem burnout.
            O sistema operacional pessoal para criadores de conteúdo brasileiros.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="xl" onClick={() => navigate("/signup")}>
              Começar agora <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
            <Button variant="outline" size="xl" onClick={() => navigate("/login")}>
              Já tenho conta
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="bg-card rounded-xl p-8 shadow-warm-sm hover:shadow-warm-md transition-all duration-200 border border-border"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <feature.icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="text-xl font-display font-bold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground font-body leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="bg-card rounded-2xl p-12 shadow-warm-lg border border-border">
          <h3 className="text-3xl font-display font-extrabold text-foreground mb-4">
            Pronto pra criar com consistência?
          </h3>
          <p className="text-muted-foreground font-body mb-8">
            Junte-se a criadores que pararam de improvisar e começaram a construir sua presença online com intenção.
          </p>
          <Button variant="hero" size="xl" onClick={() => navigate("/signup")}>
            Criar minha conta <ArrowRight className="ml-1 h-5 w-5" />
          </Button>
          <p className="text-sm text-muted-foreground mt-4">A partir de R$47/mês • Cancele quando quiser</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-sm text-muted-foreground font-body">
          © 2026 Criadores. Feito com ❤️ para criadores brasileiros.
        </p>
      </footer>
    </div>
  );
};

export default Landing;

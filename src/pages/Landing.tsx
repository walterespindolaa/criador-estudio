import { motion } from "framer-motion";
import {
  ArrowRight,
  BookMarked,
  CalendarDays,
  Check,
  Clock,
  FileText,
  Grid3X3,
  Hash,
  Heart,
  Instagram,
  Kanban,
  Lightbulb,
  MessageSquare,
  Shield,
  Sparkles,
  User,
  Youtube,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Lightbulb,
    emoji: "💡",
    title: "Capture ideias",
    description: "Anotou? Está salvo. Nunca mais perca aquela ideia no banho.",
    gradient: "from-amber-500 to-sky-500",
  },
  {
    icon: Kanban,
    emoji: "📋",
    title: "Pipeline visual",
    description: "Kanban de criação: do rascunho ao publicado em colunas visuais.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: CalendarDays,
    emoji: "📅",
    title: "Calendário de conteúdo",
    description: "Veja sua semana e mês. Arraste posts entre dias.",
    gradient: "from-teal-500 to-emerald-500",
  },
  {
    icon: Sparkles,
    emoji: "✨",
    title: "IA que entende você",
    description: "Legendas, hashtags e sugestões personalizadas pro seu nicho.",
    gradient: "from-primary to-purple-600",
  },
  {
    icon: Grid3X3,
    emoji: "📱",
    title: "Preview do feed",
    description: "Organize visualmente como seu Instagram vai ficar antes de postar.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: BookMarked,
    emoji: "🎨",
    title: "Brandbook pessoal",
    description: "Defina sua identidade visual, tom de voz e público-alvo.",
    gradient: "from-amber-600 to-orange-500",
  },
];

const steps = [
  {
    icon: User,
    title: "Configure seu perfil",
    description: "Conte quem você é, seu nicho e seu público.",
  },
  {
    icon: Kanban,
    title: "Crie e organize",
    description: "Use o kanban para tirar ideias do papel.",
  },
  {
    icon: CalendarDays,
    title: "Publique com consistência",
    description: "Calendário visual + IA para nunca mais travar.",
  },
];

const aiCapabilities = [
  { icon: FileText, label: "Gera legendas", desc: "No tom da sua marca" },
  { icon: Hash, label: "Sugere hashtags", desc: "Por relevância" },
  { icon: Lightbulb, label: "Dá ideias", desc: "Pro seu nicho" },
  { icon: Clock, label: "Melhor horário", desc: "Baseado nos seus dados" },
];

const testimonials = [
  {
    name: "Ana Vitória",
    handle: "@anavitoria.lifestyle",
    quote: "Finalmente parei de improvisar. O CreatorsFlow virou meu cérebro fora do cérebro.",
    initial: "A",
    color: "from-pink-500 to-rose-500",
  },
  {
    name: "Pedro Sales",
    handle: "@pedro.cria",
    quote: "Triplicou minha consistência. Em 3 meses fiz mais conteúdo do que no ano inteiro passado.",
    initial: "P",
    color: "from-blue-500 to-cyan-500",
  },
  {
    name: "Carla Mendonça",
    handle: "@carlamendonca",
    quote: "A IA me dá ideias quando travo. É como ter uma sócia criativa 24h.",
    initial: "C",
    color: "from-violet-500 to-purple-500",
  },
];

const planFeatures = [
  "Captura ilimitada de ideias",
  "Kanban com colunas customizáveis",
  "Calendário semanal + mensal",
  "Preview de feed do Instagram",
  "Cria IA: legendas, hashtags e ideias",
  "Brandbook completo (persona, tom, valores)",
  "Biblioteca de hooks e prompts",
  "Histórico e analytics dos seus posts",
];

const Landing = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Header ─── */}
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-200",
          scrolled ? "bg-background/85 backdrop-blur-md border-b border-border/60" : "bg-transparent"
        )}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 max-w-6xl mx-auto">
          <button onClick={() => scrollTo("hero")} className="text-xl font-display font-extrabold text-foreground">
            CreatorsFlow
          </button>
          <nav className="hidden md:flex items-center gap-6 text-sm font-body text-muted-foreground">
            <button onClick={() => scrollTo("features")} className="hover:text-foreground transition-colors">
              Funcionalidades
            </button>
            <button onClick={() => scrollTo("pricing")} className="hover:text-foreground transition-colors">
              Preço
            </button>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button variant="hero" size="sm" onClick={() => navigate("/signup")}>
              Começar grátis
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section id="hero" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-24 lg:pt-24 lg:pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-body font-semibold px-3 py-1 rounded-full mb-6">
                <Sparkles className="h-3 w-3" />
                Seu cérebro criativo potencializado por IA
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-foreground leading-[1.05] tracking-tight mb-5">
                De ideia solta a{" "}
                <span className="bg-gradient-to-r from-primary via-purple-600 to-pink-500 bg-clip-text text-transparent">
                  conteúdo publicado.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground font-body leading-relaxed max-w-xl mb-8">
                Sem ansiedade. Sem burnout. Só você e seu melhor conteúdo. O sistema operacional pessoal para criadores brasileiros.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Button variant="hero" size="lg" onClick={() => navigate("/signup")} className="text-base">
                  Começar grátis <ArrowRight className="ml-1 h-5 w-5" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => scrollTo("features")} className="text-base">
                  Ver como funciona
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-body text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-500" /> Seus dados protegidos
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" /> Setup em 2 minutos
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-primary" /> Feito no Brasil
                </span>
              </div>
            </motion.div>

            {/* Dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="hidden lg:block"
            >
              <DashboardMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-foreground tracking-tight mb-4">
              Tudo o que você precisa
              <br />
              num só lugar.
            </h2>
            <p className="text-base text-muted-foreground font-body max-w-xl mx-auto">
              Para de pular entre Notion, planilha, agenda e bloco de notas. Construa seu fluxo num só sistema.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="bg-card rounded-2xl p-6 shadow-warm-sm hover:shadow-warm-md hover:scale-[1.01] transition-all duration-200 border border-border"
              >
                <div
                  className={cn(
                    "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-sm",
                    feature.gradient
                  )}
                >
                  <feature.icon className="h-5 w-5 text-white" strokeWidth={1.75} />
                </div>
                <h3 className="text-lg font-display font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                  <span aria-hidden="true">{feature.emoji}</span>
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Como funciona ─── */}
      <section className="py-20 lg:py-24 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-body font-semibold uppercase tracking-wider text-primary mb-3 block">
              Como funciona
            </span>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground tracking-tight">
              Três passos pra sair do caos.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-2 relative">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative bg-card rounded-2xl p-6 border border-border md:mx-2"
              >
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-sm mb-4">
                  {i + 1}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <step.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  <h3 className="text-base font-display font-bold text-foreground">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">{step.description}</p>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 z-10" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Seção IA (Cria IA) ─── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-8 sm:p-12 lg:p-16 text-white">
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
              <Sparkles className="h-64 w-64 -translate-y-16 translate-x-16" />
            </div>
            <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur text-xs font-body font-semibold px-3 py-1 rounded-full mb-5">
                  <Sparkles className="h-3 w-3" />
                  Cria IA
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight leading-tight mb-4">
                  Sua assistente criativa.
                  <br />
                  Sempre disponível.
                </h2>
                <p className="text-base text-white/85 font-body leading-relaxed max-w-md">
                  Treinada com o seu brandbook, persona e nicho. A Cria IA sabe quem você é e como você fala.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {aiCapabilities.map((cap, i) => (
                  <motion.div
                    key={cap.label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.07 }}
                    className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-4"
                  >
                    <cap.icon className="h-5 w-5 mb-2" strokeWidth={1.75} />
                    <p className="text-sm font-display font-bold mb-0.5">{cap.label}</p>
                    <p className="text-xs text-white/70 font-body">{cap.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Depoimentos ─── */}
      <section className="py-20 lg:py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground tracking-tight mb-3">
              Criadores que pararam de improvisar.
            </h2>
            <p className="text-xs text-muted-foreground font-body italic">Em breve: depoimentos reais de criadores beta.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-card rounded-2xl p-6 border border-border shadow-warm-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "w-11 h-11 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-display font-bold",
                      t.color
                    )}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-sm font-display font-bold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground font-body">{t.handle}</p>
                  </div>
                </div>
                <p className="text-sm font-body text-foreground/90 leading-relaxed italic">"{t.quote}"</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Preço ─── */}
      <section id="pricing" className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground tracking-tight mb-3">
              Tudo o que você precisa.
              <br />
              Um preço simples.
            </h2>
            <p className="text-base text-muted-foreground font-body">Sem planos confusos. Tudo já incluído.</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="bg-card rounded-3xl p-8 sm:p-10 border border-border shadow-warm-lg"
          >
            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-body font-semibold px-3 py-1 rounded-full mb-4">
                <Zap className="h-3 w-3" />
                7 dias grátis · Cancele quando quiser
              </span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-display font-extrabold text-foreground">R$ 47</span>
                <span className="text-base text-muted-foreground font-body">/mês</span>
              </div>
              <p className="text-xs text-muted-foreground font-body mt-1">ou R$ 470/ano (2 meses grátis)</p>
            </div>

            <ul className="space-y-3 mb-8">
              {planFeatures.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                  </span>
                  <span className="text-sm font-body text-foreground">{feat}</span>
                </li>
              ))}
            </ul>

            <Button variant="hero" size="lg" className="w-full text-base" onClick={() => navigate("/signup")}>
              Começar agora <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ─── CTA Final ─── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-pink-500/10 rounded-3xl p-10 sm:p-16 text-center border border-primary/15">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-foreground tracking-tight mb-4">
              Pronto pra parar de improvisar?
            </h2>
            <p className="text-base text-muted-foreground font-body mb-8 max-w-xl mx-auto">
              Junte-se à comunidade de criadores brasileiros que construíram um sistema. Não um caos.
            </p>
            <Button variant="hero" size="lg" onClick={() => navigate("/signup")} className="text-base">
              Criar minha conta grátis <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="text-lg font-display font-extrabold text-foreground">CreatorsFlow</span>
              <span className="text-xs text-muted-foreground font-body">· feito com 💜 para criadores brasileiros</span>
            </div>
            <div className="flex items-center gap-5 text-sm font-body text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Termos</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
              <a href="#" className="hover:text-foreground transition-colors">Contato</a>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <a href="#" aria-label="Instagram" className="hover:text-foreground transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" aria-label="YouTube" className="hover:text-foreground transition-colors">
                <Youtube className="h-4 w-4" />
              </a>
              <a href="#" aria-label="Conversa" className="hover:text-foreground transition-colors">
                <MessageSquare className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

function DashboardMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-primary/15 via-transparent to-pink-500/15 rounded-[2.5rem] blur-2xl -z-10" />
      <div className="bg-card rounded-3xl border border-border shadow-warm-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="h-2.5 w-32 bg-muted rounded-full" />
            <div className="h-2 w-20 bg-muted/70 rounded-full mt-1.5" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { color: "from-violet-500/20 to-purple-500/5", icon: Lightbulb, count: 12 },
            { color: "from-blue-500/20 to-sky-500/5", icon: FileText, count: 4 },
            { color: "from-emerald-500/20 to-teal-500/5", icon: Check, count: 23 },
          ].map((stat, i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl p-3 bg-gradient-to-br border border-border/50",
                stat.color
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-foreground/85 flex items-center justify-center mb-2">
                <stat.icon className="h-3.5 w-3.5 text-background" strokeWidth={1.75} />
              </div>
              <p className="text-xl font-display font-extrabold text-foreground leading-none">{stat.count}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-br from-primary/5 to-transparent rounded-2xl border border-primary/15 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            <div className="h-2 w-24 bg-muted rounded-full" />
          </div>
          <div className="h-8 bg-background rounded-xl border border-border" />
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-3 border border-amber-200/40">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <div className="h-2 w-20 bg-amber-700/30 rounded-full" />
          </div>
          <div className="h-2 w-full bg-amber-700/15 rounded-full mb-1" />
          <div className="h-2 w-4/5 bg-amber-700/15 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default Landing;

import { motion } from "framer-motion";
import {
  BookMarked,
  CalendarDays,
  Check,
  Grid3X3,
  Instagram,
  Kanban,
  Lightbulb,
  Link2,
  Sparkles,
  User,
  Youtube,
  BarChart3,
  X,
  Play
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Logo } from "@/components/shared/Logo";

// --- Components ---

const MockupVisual = () => (
  <div className="bg-[#0f172a] rounded-[24px] p-6 shadow-2xl border border-slate-800/60 transform rotate-1 sm:rotate-2 hover:rotate-0 transition-transform duration-500 relative">
    <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent rounded-[24px] pointer-events-none" />
    <div className="flex gap-2 mb-6 relative z-10">
      <div className="w-3 h-3 rounded-full bg-red-500/80" />
      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
      <div className="w-3 h-3 rounded-full bg-green-500/80" />
    </div>
    <div className="space-y-4 relative z-10">
      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 flex items-center justify-between backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="w-32 h-3 bg-slate-700 rounded-full mb-2" />
            <div className="w-20 h-2 bg-slate-700/50 rounded-full" />
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
          Ideia
        </span>
      </div>
      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 flex items-center justify-between backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="w-40 h-3 bg-slate-700 rounded-full mb-2" />
            <div className="w-24 h-2 bg-slate-700/50 rounded-full" />
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          Gravando
        </span>
      </div>
      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 flex items-center justify-between backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <div className="w-36 h-3 bg-slate-700 rounded-full mb-2" />
            <div className="w-16 h-2 bg-slate-700/50 rounded-full" />
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
          Publicado
        </span>
      </div>
    </div>
  </div>
);

const featuresList = [
  {
    icon: Lightbulb,
    title: "Banco de Ideias",
    description: "Capture no celular, organize por pilar e formato. Nunca perca uma ideia no banho.",
    gradient: "from-amber-500 to-yellow-400",
  },
  {
    icon: Kanban,
    title: "Pipeline Kanban",
    description: "Do rascunho ao publicado em colunas visuais. Veja seu conteúdo fluir.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: CalendarDays,
    title: "Calendário + Metas",
    description: "Planeje semanas, defina metas mensais e acompanhe sua consistência com hábitos.",
    gradient: "from-teal-500 to-emerald-500",
  },
  {
    icon: Sparkles,
    title: "cria",
    description: "IA que conhece seu nicho: gera legendas, hashtags, ideias e roteiros no seu tom.",
    gradient: "from-primary to-purple-600",
  },
  {
    icon: Grid3X3,
    title: "Feed + Agendamento",
    description: "Veja como seu grid vai ficar e agende posts direto para Instagram, TikTok e YouTube.",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: Link2,
    title: "Link in Bio",
    description: "Sua mini landing page profissional com todos os links que importam. Incluso no plano.",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    icon: BarChart3,
    title: "Relatórios e Analytics",
    description: "Alcance, impressões e engajamento reais das suas redes. Entenda o que está funcionando.",
    gradient: "from-orange-500 to-red-500",
  },
  {
    icon: BookMarked,
    title: "Brandbook + Biblioteca",
    description: "Defina sua identidade visual, tom de voz, hooks e prompts favoritos em um só lugar.",
    gradient: "from-amber-600 to-orange-500",
  },
];

const stepsList = [
  {
    icon: User,
    num: "01",
    title: "Configure seu espaço criativo",
    description: "Defina seu nicho, plataformas e seus pilares de conteúdo.",
  },
  {
    icon: Kanban,
    num: "02",
    title: "Crie com sistema",
    description: "Use o kanban, a IA e o calendário para produzir sem travar.",
  },
  {
    icon: BarChart3,
    num: "03",
    title: "Publique e analise",
    description: "Agende direto para as redes e veja o que gerou resultado.",
  },
];

const aiList = [
  { emoji: "✍️", title: "Gera legendas completas", desc: "— no estilo e tom da sua marca" },
  { emoji: "#️⃣", title: "Sugere hashtags", desc: "— por relevância e nicho" },
  { emoji: "💡", title: "Dá ideias de conteúdo", desc: "— baseado nos seus pilares" },
  { emoji: "📊", title: "Analisa seus resultados", desc: "— e sugere o que fazer diferente" },
];

const testimonialsList = [
  {
    name: "Ana Vitória",
    handle: "@anavitoria.lifestyle",
    quote: "Finalmente parei de improvisar. O cria virou meu cérebro fora do cérebro.",
    gradient: "from-pink-500 to-rose-500",
    initial: "A"
  },
  {
    name: "Pedro Sales",
    handle: "@pedro.cria",
    quote: "Triplicou minha consistência. Em 3 meses fiz mais conteúdo do que no ano inteiro anterior.",
    gradient: "from-blue-500 to-cyan-500",
    initial: "P"
  },
  {
    name: "Carla Mendonça",
    handle: "@carlamendonca",
    quote: "A cria me dá ideias quando trava. É como ter uma sócia criativa disponível 24h.",
    gradient: "from-violet-500 to-purple-500",
    initial: "C"
  }
];

const faqs = [
  {
    q: "Preciso saber mexer com tecnologia?",
    a: "Não. O cria foi feito para criadores, não para especialistas em marketing. A interface é guiada e intuitiva do zero."
  },
  {
    q: "Funciona com qual plataforma?",
    a: "Instagram, TikTok e YouTube. Você conecta suas contas e o sistema publica, coleta métricas e gera insights automaticamente."
  },
  {
    q: "A IA é genérica ou personalizada?",
    a: "Personalizada. Ela aprende seu nicho, tom de voz e pilares de conteúdo para gerar sugestões que parecem escritas por você."
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Sem fidelidade, sem multa. Se não gostar, cancela com um clique."
  }
];

export default function Landing() {
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

  const fadeUp = {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5 }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {/* ─── 1. HEADER ─── */}
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-all duration-300",
          scrolled ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm" : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => scrollTo("hero")}>
            <Logo className="h-8 w-auto" />
          </div>

          <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-muted-foreground">
            <button onClick={() => scrollTo("features")} className="hover:text-foreground transition-colors">Funcionalidades</button>
            <button onClick={() => scrollTo("how-it-works")} className="hover:text-foreground transition-colors">Como funciona</button>
            <button onClick={() => scrollTo("pricing")} className="hover:text-foreground transition-colors">Preço</button>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hidden sm:flex font-semibold" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button variant="hero" className="font-semibold shadow-md" onClick={() => navigate("/signup")}>
              Começar grátis &rarr;
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ─── 2. HERO ─── */}
        <section id="hero" className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-screen bg-gradient-to-b from-primary/5 via-transparent to-transparent -z-10 pointer-events-none" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              <motion.div {...fadeUp} className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 border border-primary/20 shadow-sm">
                  <Sparkles className="w-4 h-4" />
                  ✦ Para criadores brasileiros
                </div>
                
                <h1 className="text-5xl lg:text-6xl font-display font-extrabold tracking-tight leading-[1.1] mb-6">
                  Do caos criativo ao <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-600 to-pink-500">conteúdo publicado.</span>
                </h1>
                
                <p className="text-lg lg:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Um sistema operacional completo para criadores de conteúdo. Ideias, roteiros, agendamento e análise — tudo em um só lugar.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-8">
                  <Button variant="hero" size="lg" className="w-full sm:w-auto text-base h-14 px-8" onClick={() => navigate("/signup")}>
                    Começar grátis &rarr;
                  </Button>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto text-base h-14 px-8" onClick={() => scrollTo("how-it-works")}>
                    Ver como funciona
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-6 text-sm text-muted-foreground font-medium">
                  <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> 14 dias grátis</div>
                  <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> Sem cartão</div>
                  <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> Cancele quando quiser</div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mx-auto w-full max-w-md lg:max-w-full"
              >
                <MockupVisual />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── 3. LOGOS DE PLATAFORMAS ─── */}
        <section className="py-12 bg-muted/30 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-sm font-semibold text-muted-foreground mb-6 uppercase tracking-wider">
              Funciona com as plataformas que você já usa:
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-16 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
              <div className="flex items-center gap-2 font-display font-bold text-xl text-foreground">
                <Instagram className="w-7 h-7" /> Instagram
              </div>
              <div className="flex items-center gap-2 font-display font-bold text-xl text-foreground">
                <Play className="w-7 h-7" /> TikTok
              </div>
              <div className="flex items-center gap-2 font-display font-bold text-xl text-foreground">
                <Youtube className="w-7 h-7" /> YouTube
              </div>
            </div>
          </div>
        </section>

        {/* ─── 4. FUNCIONALIDADES ─── */}
        <section id="features" className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-4">
                Tudo que você precisa. <span className="text-muted-foreground">Nada que você não precisa.</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Cada módulo foi pensado para o criador que trabalha sozinho.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {featuresList.map((f, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-warm-sm hover:shadow-warm-md hover:border-primary/20 transition-all duration-300"
                >
                  <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-6 shadow-inner", f.gradient)}>
                    <f.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-display font-bold mb-3">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 5. COMO FUNCIONA ─── */}
        <section id="how-it-works" className="py-20 lg:py-28 bg-muted/30 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-4">
                Em 3 passos, você para de improvisar.
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 z-0" />
              {stepsList.map((s, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="relative z-10 bg-card border border-border rounded-2xl p-8 shadow-warm-sm flex flex-col items-center text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center font-display font-bold text-xl mb-6 shadow-glow border-4 border-background">
                    {s.num}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <s.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-display font-bold mb-3">{s.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {s.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 6. DESTAQUE IA ─── */}
        <section className="py-20 lg:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-600/5 -z-10" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <motion.div {...fadeUp}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                  <Sparkles className="w-4 h-4" /> Inteligência Artificial
                </div>
                <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-4">
                  A cria trabalha enquanto você cria.
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                  Não é um chatbot genérico. É uma IA que conhece seu nicho, seu tom e seu público.
                </p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="grid sm:grid-cols-2 gap-4"
              >
                {aiList.map((ai, i) => (
                  <div key={i} className="bg-card border border-border rounded-2xl p-6 shadow-warm-sm">
                    <div className="text-2xl mb-3">{ai.emoji}</div>
                    <h4 className="font-display font-bold text-foreground mb-1">{ai.title}</h4>
                    <p className="text-sm text-muted-foreground">{ai.desc}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── 7. COMPARATIVO ─── */}
        <section className="py-20 lg:py-28 bg-muted/30 border-y border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-4">
                Por que não Buffer, mLabs ou Later?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Essas ferramentas foram feitas para agências. O cria foi feito para você.
              </p>
            </motion.div>
            
            <motion.div {...fadeUp} className="overflow-x-auto rounded-2xl border border-border bg-card shadow-warm-sm">
              <table className="w-full min-w-[600px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-sm font-display font-bold text-foreground">
                    <th className="p-4 sm:p-6 w-2/5">Funcionalidade</th>
                    <th className="p-4 sm:p-6 w-1/5 text-center bg-primary/10 border-x border-primary/20 text-primary">cria</th>
                    <th className="p-4 sm:p-6 w-1/5 text-center text-muted-foreground">Buffer/Later</th>
                    <th className="p-4 sm:p-6 w-1/5 text-center text-muted-foreground">mLabs</th>
                  </tr>
                </thead>
                <tbody className="font-body text-sm text-foreground/90 divide-y divide-border">
                  <tr>
                    <td className="p-4 sm:p-6 font-medium">Banco de ideias integrado</td>
                    <td className="p-4 sm:p-6 text-center bg-primary/5 border-x border-primary/20"><Check className="w-5 h-5 mx-auto text-primary" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-6 font-medium">Roteiro e produção com IA</td>
                    <td className="p-4 sm:p-6 text-center bg-primary/5 border-x border-primary/20"><Check className="w-5 h-5 mx-auto text-primary" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-6 font-medium">Brandbook e identidade visual</td>
                    <td className="p-4 sm:p-6 text-center bg-primary/5 border-x border-primary/20"><Check className="w-5 h-5 mx-auto text-primary" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-6 font-medium">Link in Bio incluso</td>
                    <td className="p-4 sm:p-6 text-center bg-primary/5 border-x border-primary/20"><Check className="w-5 h-5 mx-auto text-primary" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground font-medium">Pago à parte</td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-6 font-medium">Preço acessível para pessoa física</td>
                    <td className="p-4 sm:p-6 text-center bg-primary/10 border-x border-b-0 border-primary/20 rounded-b-2xl"><Check className="w-5 h-5 mx-auto text-primary" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground font-medium">Parcial</td>
                  </tr>
                </tbody>
              </table>
            </motion.div>
          </div>
        </section>

        {/* ─── 8. DEPOIMENTOS ─── */}
        <section className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight">
                Criadores que pararam de improvisar.
              </h2>
            </motion.div>
            
            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {testimonialsList.map((t, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="bg-card border border-border rounded-2xl p-8 shadow-warm-sm flex flex-col h-full"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white font-display font-bold text-lg bg-gradient-to-br shadow-inner", t.gradient)}>
                      {t.initial}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-foreground">{t.name}</h4>
                      <p className="text-sm text-muted-foreground">{t.handle}</p>
                    </div>
                  </div>
                  <p className="text-foreground/90 italic leading-relaxed flex-1">
                    "{t.quote}"
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 9. PREÇO ─── */}
        <section id="pricing" className="py-20 lg:py-28 bg-muted/30 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-4">
                Um plano. Tudo incluso.
              </h2>
              <p className="text-lg text-muted-foreground">
                Sem surpresa, sem plano básico que não serve.
              </p>
            </motion.div>

            <motion.div 
              {...fadeUp}
              className="max-w-lg mx-auto bg-card border-2 border-primary/20 rounded-3xl p-8 sm:p-10 shadow-glow relative"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 shadow-md">
                <Sparkles className="w-4 h-4" /> ✦ Mais popular
              </div>
              
              <div className="text-center mb-8 pt-4">
                <h3 className="text-2xl font-display font-bold mb-2">Criador Pro</h3>
                <div className="flex items-center justify-center gap-3 mb-2">
                  <span className="text-2xl text-muted-foreground line-through font-display font-semibold opacity-60">R$ 47</span>
                  <span className="text-5xl font-display font-extrabold text-foreground tracking-tight">R$ 29<span className="text-xl font-body font-normal text-muted-foreground">/mês</span></span>
                </div>
                <p className="text-sm text-primary font-semibold">ou R$ 297/ano — 2 meses grátis</p>
              </div>

              <div className="space-y-4 mb-8">
                {[
                  "Banco de ideias ilimitado",
                  "Pipeline kanban completo",
                  "Calendário + metas mensais",
                  "Acompanhamento de hábitos",
                  "cria (legendas, hashtags, ideias, roteiros)",
                  "Agendamento Instagram, TikTok e YouTube",
                  "Preview de feed do Instagram",
                  "Link in Bio profissional",
                  "Brandbook + Biblioteca pessoal",
                  "Relatórios e analytics das redes",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-primary/10 p-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground/90 font-medium">{item}</span>
                  </div>
                ))}
              </div>

              <Button variant="hero" size="xl" className="w-full text-lg h-14" onClick={() => navigate("/signup")}>
                Começar 14 dias grátis &rarr;
              </Button>
              <p className="text-center text-sm text-muted-foreground mt-4 font-medium">
                Sem cartão de crédito. Cancele quando quiser.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ─── 10. FAQ ─── */}
        <section className="py-20 lg:py-28">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight">
                Perguntas frequentes
              </h2>
            </motion.div>
            
            <motion.div {...fadeUp}>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`item-${i}`} className="border-border">
                    <AccordionTrigger className="text-left font-display font-bold text-lg hover:text-primary transition-colors py-5">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="font-body text-muted-foreground text-base leading-relaxed pb-5">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>

        {/* ─── 11. CTA FINAL ─── */}
        <section className="py-24 lg:py-32 relative overflow-hidden border-t border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-purple-600/8 -z-10" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <motion.div {...fadeUp}>
              <h2 className="text-4xl lg:text-5xl font-display font-extrabold tracking-tight mb-6">
                Pronto para parar de improvisar?
              </h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                Junte-se a criadores que produziram mais em 30 dias do que em 6 meses tentando sozinhos.
              </p>
              <Button variant="hero" size="xl" className="h-16 px-10 text-lg shadow-glow hover:shadow-glow-hover" onClick={() => navigate("/signup")}>
                Criar minha conta grátis &rarr;
              </Button>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm text-muted-foreground font-medium">
                <span>14 dias grátis</span>
                <span className="hidden sm:inline">&middot;</span>
                <span>Sem cartão</span>
                <span className="hidden sm:inline">&middot;</span>
                <span>Cancele quando quiser</span>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ─── 12. FOOTER ─── */}
      <footer className="py-12 border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center">
            <Logo className="h-6 w-auto" />
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-primary transition-colors">Privacidade</a>
            <a href="#" className="hover:text-primary transition-colors">Contato</a>
          </div>

          <div className="flex items-center gap-4 text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors"><Instagram className="w-5 h-5" /></a>
            <a href="#" className="hover:text-primary transition-colors"><Play className="w-5 h-5" /></a>
            <a href="#" className="hover:text-primary transition-colors"><Youtube className="w-5 h-5" /></a>
            <a href="#" className="hover:text-primary transition-colors"><Link2 className="w-5 h-5" /></a>
          </div>
        </div>
        <div className="mt-8 text-center text-sm text-muted-foreground">
          © 2025 cria. Feito com ♥ para criadores brasileiros.
        </div>
      </footer>
    </div>
  );
}

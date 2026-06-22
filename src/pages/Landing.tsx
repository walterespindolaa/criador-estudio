import { motion, AnimatePresence } from "framer-motion";
import {
  BookMarked,
  CalendarDays,
  Check,
  Grid3X3,
  Instagram,
  Kanban,
  Lightbulb,
  Link2,
  Menu,
  Users,
  Wallet,
  ClipboardCheck,
  Sparkles,
  User,
  Youtube,
  Music2,
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
import { PLANS } from "@/lib/plans";
import { useT } from "@/lib/i18n";

// --- Components ---

const MockupVisual = () => {
  const t = useT();
  return (
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
          {t("landing.stIdea")}
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
          {t("landing.stRecording")}
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
          {t("landing.stPublished")}
        </span>
      </div>
    </div>
  </div>
  );
};

const bentoList = [
  { icon: Kanban, tk: "landing.bPipelineT", dk: "landing.bPipelineD", gradient: "from-primary to-purple-600", span: "col", feature: true },
  { icon: Lightbulb, tk: "landing.bIdeasT", dk: "landing.bIdeasD", gradient: "from-amber-500 to-yellow-400" },
  { icon: Link2, tk: "landing.bLinkT", dk: "landing.bLinkD", gradient: "from-rose-500 to-pink-500" },
  { icon: Sparkles, tk: "landing.bAiT", dk: "landing.bAiD", gradient: "from-violet-600 to-fuchsia-600", span: "col", feature: true },
  { icon: CalendarDays, tk: "landing.bCalT", dk: "landing.bCalD", gradient: "from-teal-500 to-emerald-500" },
  { icon: BarChart3, tk: "landing.bReportsT", dk: "landing.bReportsD", gradient: "from-orange-500 to-red-500" },
  { icon: BookMarked, tk: "landing.bBrandT", dk: "landing.bBrandD", gradient: "from-amber-600 to-orange-500" },
];

const marqueeItems = [
  { icon: Instagram, lk: "Instagram" },
  { icon: Music2, lk: "TikTok" },
  { icon: Youtube, lk: "YouTube" },
  { icon: Lightbulb, lk: "landing.ideaBank" },
  { icon: Kanban, lk: "landing.pipeline" },
  { icon: CalendarDays, lk: "landing.calendar" },
  { icon: Sparkles, lk: "landing.aiCria" },
  { icon: Link2, lk: "landing.linkBio" },
  { icon: BarChart3, lk: "landing.analytics" },
  { icon: BookMarked, lk: "landing.brandbook" },
];

const aiList = [
  { emoji: "✍️", tk: "landing.aiCapT", dk: "landing.aiCapD" },
  { emoji: "#️⃣", tk: "landing.aiHashT", dk: "landing.aiHashD" },
  { emoji: "💡", tk: "landing.aiIdeaT", dk: "landing.aiIdeaD" },
  { emoji: "📊", tk: "landing.aiAnalT", dk: "landing.aiAnalD" },
];

const testimonialsList = [
  { name: "Ana Vitória", handle: "@anavitoria.lifestyle", qk: "landing.testQ1", gradient: "from-pink-500 to-rose-500", initial: "A" },
  { name: "Pedro Sales", handle: "@pedro.cria", qk: "landing.testQ2", gradient: "from-blue-500 to-cyan-500", initial: "P" },
  { name: "Carla Mendonça", handle: "@carlamendonca", qk: "landing.testQ3", gradient: "from-violet-500 to-purple-500", initial: "C" },
];

const faqs = [
  { qk: "landing.faqQ1", ak: "landing.faqA1" },
  { qk: "landing.faqQ2", ak: "landing.faqA2" },
  { qk: "landing.faqQ3", ak: "landing.faqA3" },
  { qk: "landing.faqQ4", ak: "landing.faqA4" },
];

export default function Landing() {
  const navigate = useNavigate();
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

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
          scrolled || menuOpen ? "bg-background/90 backdrop-blur-md border-b border-border shadow-sm" : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setMenuOpen(false); scrollTo("hero"); }}>
            <Logo className="h-8 w-auto" />
            <span className="font-display font-bold text-foreground text-base sm:text-lg">Cria Social Club</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-muted-foreground">
            <button onClick={() => scrollTo("features")} className="hover:text-foreground transition-colors">{t("landing.navFeatures")}</button>
            <button onClick={() => scrollTo("how-it-works")} className="hover:text-foreground transition-colors">{t("landing.navHow")}</button>
            <button onClick={() => scrollTo("modulos")} className="hover:text-foreground transition-colors">{t("landing.navManagers")}</button>
            <button onClick={() => scrollTo("pricing")} className="hover:text-foreground transition-colors">{t("landing.navPricing")}</button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" className="font-semibold px-3 sm:px-4" onClick={() => navigate("/login")}>
              {t("landing.login")}
            </Button>
            <Button variant="hero" className="hidden sm:flex font-semibold shadow-md" onClick={() => navigate("/signup")}>
              {t("landing.startFree")} &rarr;
            </Button>
            <button
              type="button"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border text-foreground hover:bg-muted/50 transition-colors"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden bg-background/95 backdrop-blur-md border-t border-border"
            >
              <div className="px-4 py-3 flex flex-col">
                {[
                  { id: "features", label: t("landing.navFeatures") },
                  { id: "how-it-works", label: t("landing.navHow") },
                  { id: "modulos", label: t("landing.navManagers") },
                  { id: "pricing", label: t("landing.navPricing") },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setMenuOpen(false); scrollTo(item.id); }}
                    className="text-left py-3 px-2 rounded-lg font-medium text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
                <div className="h-px bg-border my-2" />
                <Button variant="hero" className="w-full font-semibold h-12" onClick={() => { setMenuOpen(false); navigate("/signup"); }}>
                  {t("landing.startFree")} &rarr;
                </Button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* ─── 2. HERO ─── */}
        <section id="hero" className="relative pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-screen bg-gradient-to-b from-primary/5 via-transparent to-transparent -z-10 pointer-events-none" />
          <div className="absolute top-10 right-0 w-72 h-72 rounded-full bg-primary/20 blur-3xl -z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-purple-400/15 blur-3xl -z-10 pointer-events-none" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              <motion.div {...fadeUp} className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 border border-primary/20 shadow-sm">
                  <Sparkles className="w-4 h-4" />
                  {t("landing.heroBadge")}
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight leading-[1.1] mb-6">
                  {t("landing.heroTitlePre")}<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-600 to-pink-500">{t("landing.heroTitleHighlight")}</span>
                </h1>

                <p className="text-lg lg:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  {t("landing.heroSubtitle")}
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-8">
                  <Button variant="hero" size="lg" className="w-full sm:w-auto text-base h-14 px-8" onClick={() => navigate("/signup")}>
                    {t("landing.startFree")} &rarr;
                  </Button>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto text-base h-14 px-8" onClick={() => scrollTo("how-it-works")}>
                    {t("landing.heroCtaSecondary")}
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-6 text-sm text-muted-foreground font-medium">
                  <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> {t("landing.trial")}</div>
                  <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> {t("landing.noCard")}</div>
                  <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> {t("landing.cancel")}</div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mx-auto w-full max-w-md lg:max-w-full"
              >
                <motion.div animate={{ y: [0, -12, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}>
                  <MockupVisual />
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── 3. MARQUEE ─── */}
        <section className="py-10 sm:py-12 bg-card border-y border-border overflow-hidden">
          <p className="text-center text-sm font-medium text-muted-foreground mb-6 px-4">
            {t("landing.marqueeTagline")}
          </p>
          <div className="relative">
            <motion.div
              className="flex gap-4 w-max"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ repeat: Infinity, ease: "linear", duration: 24 }}
            >
              {[...marqueeItems, ...marqueeItems].map((m, i) => (
                <div key={i} className="flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 shadow-warm-sm whitespace-nowrap">
                  <m.icon className="w-4 h-4 text-primary" />
                  <span className="font-display font-semibold text-sm text-foreground">{t(m.lk)}</span>
                </div>
              ))}
            </motion.div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-card to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-card to-transparent" />
          </div>
        </section>

        {/* ─── 4. FUNCIONALIDADES (BENTO) ─── */}
        <section id="features" className="scroll-mt-20 py-16 sm:py-20 lg:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-12 sm:mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4 border border-primary/20">
                <Sparkles className="w-4 h-4" /> {t("landing.featBadge")}
              </div>
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-4">
                {t("landing.featTitle")}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("landing.featSubtitle")}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:auto-rows-[200px]">
              {bentoList.map((b, i) => (
                <motion.div
                  key={b.tk}
                  {...fadeUp}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className={cn(
                    "rounded-2xl p-6 shadow-warm transition-all duration-300 flex flex-col hover:-translate-y-1.5",
                    b.feature
                      ? cn("text-white hover:shadow-glow bg-gradient-to-br", b.gradient)
                      : "bg-card border border-border hover:shadow-warm-lg",
                    b.span === "col" && "sm:col-span-2",
                  )}
                >
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-3", b.feature ? "bg-white/20" : cn("bg-gradient-to-br", b.gradient))}>
                    <b.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className={cn("text-xl font-display font-bold mb-2", b.feature ? "text-white" : "text-foreground")}>{t(b.tk)}</h3>
                  <p className={cn("text-sm leading-relaxed", b.feature ? "text-white/85" : "text-muted-foreground")}>{t(b.dk)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 5. VEJA POR DENTRO (ZIG-ZAG) ─── */}
        <section id="how-it-works" className="scroll-mt-20 py-16 sm:py-20 lg:py-28 bg-muted/30 border-y border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-4">
                {t("landing.insideTitle")}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("landing.insideSubtitle")}
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center mb-16 lg:mb-24">
              <motion.div initial={{ opacity: 0, x: -32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4 border border-primary/20">
                  <CalendarDays className="w-4 h-4" /> {t("landing.planBadge")}
                </div>
                <h3 className="text-2xl lg:text-3xl font-display font-bold mb-4">{t("landing.planTitle")}</h3>
                <p className="text-muted-foreground text-base lg:text-lg mb-6 leading-relaxed">
                  {t("landing.planDesc")}
                </p>
                <ul className="space-y-3">
                  {[t("landing.planB1"), t("landing.planB2"), t("landing.planB3")].map((item) => (
                    <li key={item} className="flex items-center gap-3 font-medium">
                      <div className="rounded-full bg-primary/10 p-0.5"><Check className="w-4 h-4 text-primary" /></div>{item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                <div className="bg-card border border-border rounded-2xl shadow-warm p-5 sm:p-6">
                  <p className="text-sm font-display font-bold text-muted-foreground mb-3">Junho 2026</p>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <div key={i} className={cn("aspect-square rounded-lg", [2, 8, 12, 17, 21, 26].includes(i) ? "bg-gradient-to-br from-primary to-purple-600" : "bg-muted")} />
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              <motion.div initial={{ opacity: 0, x: 32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4 border border-primary/20">
                  <Sparkles className="w-4 h-4" /> {t("landing.intBadge")}
                </div>
                <h3 className="text-2xl lg:text-3xl font-display font-bold mb-4">{t("landing.intTitle")}</h3>
                <p className="text-muted-foreground text-base lg:text-lg mb-6 leading-relaxed">
                  {t("landing.intDesc")}
                </p>
                <ul className="space-y-3">
                  {[t("landing.intB1"), t("landing.intB2"), t("landing.intB3")].map((item) => (
                    <li key={item} className="flex items-center gap-3 font-medium">
                      <div className="rounded-full bg-primary/10 p-0.5"><Check className="w-4 h-4 text-primary" /></div>{item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="lg:order-1">
                <div className="bg-card border border-border rounded-2xl shadow-warm p-5 sm:p-6 space-y-3">
                  <div className="bg-muted rounded-xl p-4">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> {t("landing.legendLabel")}</p>
                    <div className="h-2.5 bg-foreground/10 rounded-full mb-2 w-[90%]" />
                    <div className="h-2.5 bg-foreground/10 rounded-full w-[70%]" />
                  </div>
                  <div className="bg-gradient-to-br from-primary to-purple-600 text-white rounded-xl p-4 text-sm font-medium">
                    #rotina #produtividade #criador <span className="opacity-70">+12</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── 6. DESTAQUE IA ─── */}
        <section className="py-16 sm:py-20 lg:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-600/5 -z-10" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <motion.div {...fadeUp}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                  <Sparkles className="w-4 h-4" /> {t("landing.aiBadge")}
                </div>
                <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-4">
                  {t("landing.aiTitle")}
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                  {t("landing.aiSubtitle")}
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
                    <h4 className="font-display font-bold text-foreground mb-1">{t(ai.tk)}</h4>
                    <p className="text-sm text-muted-foreground">{t(ai.dk)}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── 7. COMPARATIVO ─── */}
        <section className="py-16 sm:py-20 lg:py-28 bg-muted/30 border-y border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-4">
                {t("landing.cmpTitle")}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("landing.cmpSubtitle")}
              </p>
            </motion.div>
            
            <motion.div {...fadeUp} className="overflow-x-auto rounded-2xl border border-border bg-card shadow-warm-sm">
              <table className="w-full min-w-[600px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-sm font-display font-bold text-foreground">
                    <th className="p-4 sm:p-6 w-2/5">{t("landing.cmpFeature")}</th>
                    <th className="p-4 sm:p-6 w-1/5 text-center bg-primary/10 border-x border-primary/20 text-primary">cria</th>
                    <th className="p-4 sm:p-6 w-1/5 text-center text-muted-foreground">Buffer/Later</th>
                    <th className="p-4 sm:p-6 w-1/5 text-center text-muted-foreground">mLabs</th>
                  </tr>
                </thead>
                <tbody className="font-body text-sm text-foreground/90 divide-y divide-border">
                  <tr>
                    <td className="p-4 sm:p-6 font-medium">{t("landing.cmpRow1")}</td>
                    <td className="p-4 sm:p-6 text-center bg-primary/5 border-x border-primary/20"><Check className="w-5 h-5 mx-auto text-primary" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-6 font-medium">{t("landing.cmpRow2")}</td>
                    <td className="p-4 sm:p-6 text-center bg-primary/5 border-x border-primary/20"><Check className="w-5 h-5 mx-auto text-primary" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-6 font-medium">{t("landing.cmpRow3")}</td>
                    <td className="p-4 sm:p-6 text-center bg-primary/5 border-x border-primary/20"><Check className="w-5 h-5 mx-auto text-primary" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-6 font-medium">{t("landing.cmpRow4")}</td>
                    <td className="p-4 sm:p-6 text-center bg-primary/5 border-x border-primary/20"><Check className="w-5 h-5 mx-auto text-primary" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground font-medium">{t("landing.cmpPaidApart")}</td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-6 font-medium">{t("landing.cmpRow5")}</td>
                    <td className="p-4 sm:p-6 text-center bg-primary/10 border-x border-b-0 border-primary/20 rounded-b-2xl"><Check className="w-5 h-5 mx-auto text-primary" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground"><X className="w-5 h-5 mx-auto opacity-30" /></td>
                    <td className="p-4 sm:p-6 text-center text-muted-foreground font-medium">{t("landing.cmpPartial")}</td>
                  </tr>
                </tbody>
              </table>
            </motion.div>
          </div>
        </section>

        {/* ─── 8. DEPOIMENTOS ─── */}
        <section className="py-16 sm:py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight">
                {t("landing.testTitle")}
              </h2>
            </motion.div>
            
            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {testimonialsList.map((tm, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="bg-card border border-border rounded-2xl p-8 shadow-warm-sm flex flex-col h-full"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white font-display font-bold text-lg bg-gradient-to-br shadow-inner", tm.gradient)}>
                      {tm.initial}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-foreground">{tm.name}</h4>
                      <p className="text-sm text-muted-foreground">{tm.handle}</p>
                    </div>
                  </div>
                  <p className="text-foreground/90 italic leading-relaxed flex-1">
                    "{t(tm.qk)}"
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 9. PREÇO ─── */}
        <section id="pricing" className="scroll-mt-20 py-16 sm:py-20 lg:py-28 bg-muted/30 border-y border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-4">
                {t("landing.priceTitle")}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t("landing.priceSubtitle")}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto items-start">
              {PLANS.map((plan, i) => (
                <motion.div
                  key={plan.id}
                  {...fadeUp}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className={cn(
                    "relative bg-card rounded-3xl p-8 shadow-warm flex flex-col",
                    plan.highlighted ? "border-2 border-primary shadow-glow" : "border border-border"
                  )}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 shadow-md whitespace-nowrap">
                      <Sparkles className="w-4 h-4" /> {t("landing.priceMostComplete")}
                    </div>
                  )}
                  <div className="text-center mb-6 pt-2">
                    <h3 className="text-2xl font-display font-bold mb-1">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                  </div>
                  <div className="text-center mb-8">
                    <span className="text-4xl font-display font-extrabold text-foreground tracking-tight">{plan.price}</span>
                    <span className="text-lg font-body text-muted-foreground">{t("landing.perMonth")}</span>
                  </div>
                  <div className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feat) => (
                      <div key={feat} className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-primary/10 p-0.5 shrink-0">
                          <Check className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-foreground/90 font-medium text-sm">{feat.replace(/^[^\p{L}]+/u, "")}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant={plan.highlighted ? "hero" : "outline"}
                    size="lg"
                    className="w-full text-base h-12"
                    onClick={() => navigate("/signup")}
                  >
                    {t("landing.priceCta")} &rarr;
                  </Button>
                </motion.div>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6 font-medium">
              {t("landing.priceFootnote")}
            </p>
          </div>
        </section>

        {/* ─── 9b. PARA QUEM GERENCIA ─── */}
        <section id="modulos" className="scroll-mt-20 py-16 sm:py-20 lg:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4 border border-primary/20">
                <Users className="w-4 h-4" /> {t("landing.mgBadge")}
              </div>
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-4">
                {t("landing.mgTitle")}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("landing.mgSubtitle")}
              </p>
            </motion.div>

            <motion.div {...fadeUp} className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Kanban, title: t("landing.mg1T"), desc: t("landing.mg1D"), gradient: "from-violet-500 to-purple-600" },
                { icon: Wallet, title: t("landing.mg2T"), desc: t("landing.mg2D"), gradient: "from-emerald-500 to-teal-500" },
                { icon: ClipboardCheck, title: t("landing.mg3T"), desc: t("landing.mg3D"), gradient: "from-blue-500 to-cyan-500" },
              ].map((m) => (
                <div key={m.title} className="rounded-2xl border border-border bg-card p-6 shadow-warm-sm hover:shadow-warm-md transition-shadow">
                  <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4", m.gradient)}>
                    <m.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-display font-bold mb-2">{m.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </motion.div>

            <motion.p {...fadeUp} className="text-center text-sm text-muted-foreground mt-8">
              {t("landing.mgFootnote")}
            </motion.p>
          </div>
        </section>

        {/* ─── 10. FAQ ─── */}
        <section className="py-16 sm:py-20 lg:py-28">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight">
                {t("landing.faqTitle")}
              </h2>
            </motion.div>
            
            <motion.div {...fadeUp}>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`item-${i}`} className="border-border">
                    <AccordionTrigger className="text-left font-display font-bold text-lg hover:text-primary transition-colors py-5">
                      {t(faq.qk)}
                    </AccordionTrigger>
                    <AccordionContent className="font-body text-muted-foreground text-base leading-relaxed pb-5">
                      {t(faq.ak)}
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
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight mb-6">
                {t("landing.ctaTitle")}
              </h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                {t("landing.ctaSubtitle")}
              </p>
              <Button variant="hero" size="xl" className="h-16 px-10 text-lg shadow-glow hover:shadow-glow-hover" onClick={() => navigate("/signup")}>
                {t("landing.ctaButton")} &rarr;
              </Button>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm text-muted-foreground font-medium">
                <span>{t("landing.trial")}</span>
                <span className="hidden sm:inline">&middot;</span>
                <span>{t("landing.noCard")}</span>
                <span className="hidden sm:inline">&middot;</span>
                <span>{t("landing.cancel")}</span>
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
            <a href="/termos" className="hover:text-primary transition-colors">{t("landing.footTerms")}</a>
            <a href="/privacidade" className="hover:text-primary transition-colors">{t("landing.footPrivacy")}</a>
            <a href="#" className="hover:text-primary transition-colors">{t("landing.footContact")}</a>
          </div>

          <div className="flex items-center gap-4 text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors"><Instagram className="w-5 h-5" /></a>
            <a href="#" className="hover:text-primary transition-colors"><Play className="w-5 h-5" /></a>
            <a href="#" className="hover:text-primary transition-colors"><Youtube className="w-5 h-5" /></a>
            <a href="#" className="hover:text-primary transition-colors"><Link2 className="w-5 h-5" /></a>
          </div>
        </div>
        <div className="mt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Cria Social Club. {t("landing.footMadeWith")}
        </div>
      </footer>
    </div>
  );
}

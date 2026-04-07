import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Instagram, Youtube, X, Plus, Sparkles } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";

const NICHE_SUGGESTIONS = [
  "Lifestyle", "Moda", "Beleza", "Fitness", "Culinária",
  "Educação", "Negócios", "Entretenimento", "Saúde", "Tecnologia",
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "tiktok", label: "TikTok", icon: () => <span className="text-lg">🎵</span> },
  { id: "youtube", label: "YouTube", icon: Youtube },
];

const PILLAR_COLORS = ["#C4622D", "#5C7A6B", "#8B6F4E", "#A4785C", "#6B8E7B", "#D4956A"];

const PILLAR_PRESETS: Record<string, string[]> = {
  Lifestyle: ["Rotina", "Dicas do dia", "Organização", "Bem-estar", "Viagens"],
  Moda: ["Looks do dia", "Tendências", "Compras conscientes", "DIY moda", "Inspirações"],
  Beleza: ["Skincare", "Makes", "Cabelo", "Produtos favoritos", "Tutoriais"],
  Fitness: ["Treinos", "Alimentação", "Motivação", "Dicas fitness", "Progresso"],
  Culinária: ["Receitas rápidas", "Sobremesas", "Dicas de cozinha", "Ingredientes", "Meal prep"],
  Educação: ["Dicas de estudo", "Conteúdo educativo", "Tutoriais", "Produtividade", "Carreira"],
  Negócios: ["Marketing", "Vendas", "Empreendedorismo", "Finanças", "Estratégia"],
  Entretenimento: ["Humor", "Trends", "Reacts", "Reviews", "Cultura pop"],
  default: ["Conteúdo pessoal", "Dicas e valor", "Bastidores", "Entretenimento", "Tendências"],
};

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateProfile } = useProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [pillars, setPillars] = useState<{ name: string; color: string }[]>([]);
  const [customPillar, setCustomPillar] = useState("");

  const goalLabels: Record<number, string> = {
    1: "Tranquilo e consistente 🌱",
    2: "Bom ritmo! 💪",
    3: "Isso é ótimo! Consistente e sustentável ✨",
    4: "Dedicado! 🔥",
    5: "Muito produtivo! 🚀",
    6: "Máquina de conteúdo! 💥",
    7: "Todos os dias! Incrível! 🏆",
  };

  const togglePlatform = (id: string) => {
    setPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const addPresetPillar = (name: string) => {
    if (pillars.length >= 5 || pillars.find(p => p.name === name)) return;
    setPillars(prev => [...prev, { name, color: PILLAR_COLORS[prev.length % PILLAR_COLORS.length] }]);
  };

  const addCustomPillar = () => {
    if (!customPillar.trim() || pillars.length >= 5) return;
    setPillars(prev => [...prev, { name: customPillar.trim(), color: PILLAR_COLORS[prev.length % PILLAR_COLORS.length] }]);
    setCustomPillar("");
  };

  const removePillar = (index: number) => {
    setPillars(prev => prev.filter((_, i) => i !== index));
  };

  const finishOnboarding = async () => {
    if (!user) return;
    await updateProfile({
      name,
      niche,
      platforms,
      weekly_goal: weeklyGoal,
      onboarding_completed: true,
    });

    // Insert pillars
    for (let i = 0; i < pillars.length; i++) {
      await supabase.from("pillars").insert({
        user_id: user.id,
        name: pillars[i].name,
        color: pillars[i].color,
        position: i,
      });
    }

    navigate("/app");
  };

  const presets = PILLAR_PRESETS[niche] || PILLAR_PRESETS.default;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <h1 className="text-4xl font-display font-bold text-foreground mb-4">
                Bem-vinda. 🌿
              </h1>
              <p className="text-lg text-muted-foreground font-body leading-relaxed mb-10 max-w-md mx-auto">
                O melhor conteúdo é aquele que você consegue sustentar a longo prazo.
                Vamos organizar isso juntas.
              </p>
              <Button variant="hero" size="xl" onClick={() => setStep(1)}>
                Vamos começar <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          )}

          {/* Step 1: Name + Niche */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div>
                <p className="text-sm text-primary font-body font-medium mb-1">Passo 1 de 3</p>
                <h2 className="text-3xl font-display font-bold text-foreground">Vamos nos conhecer</h2>
              </div>

              <div className="space-y-2">
                <Label className="font-body">Qual é o seu nome?</Label>
                <Input
                  placeholder="Como quer ser chamada?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl h-12"
                />
              </div>

              <div className="space-y-3">
                <Label className="font-body">Qual é o seu nicho?</Label>
                <Input
                  placeholder="Ex: Moda, Fitness, Educação..."
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="rounded-xl h-12"
                />
                <div className="flex flex-wrap gap-2">
                  {NICHE_SUGGESTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => setNiche(n)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-body transition-colors border ${
                        niche === n
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-foreground hover:bg-accent"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full"
                disabled={!name.trim()}
                onClick={() => setStep(2)}
              >
                Continuar <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          )}

          {/* Step 2: Platforms + Weekly Goal */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div>
                <p className="text-sm text-primary font-body font-medium mb-1">Passo 2 de 3</p>
                <h2 className="text-3xl font-display font-bold text-foreground">Suas plataformas</h2>
              </div>

              <div className="space-y-3">
                <Label className="font-body">Quais plataformas você usa?</Label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      className={`flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all ${
                        platforms.includes(p.id)
                          ? "bg-primary/10 border-primary shadow-warm"
                          : "bg-card border-border hover:bg-accent"
                      }`}
                    >
                      <PlatformIcon platform={p.id as any} size="md" />
                      <span className="text-sm font-body font-medium">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="font-body">Quantos posts por semana?</Label>
                <input
                  type="range"
                  min={1}
                  max={7}
                  value={weeklyGoal}
                  onChange={(e) => setWeeklyGoal(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-display font-bold text-primary">{weeklyGoal}x</span>
                  <span className="text-sm text-muted-foreground font-body">{goalLabels[weeklyGoal]}</span>
                </div>
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full"
                disabled={platforms.length === 0}
                onClick={() => setStep(3)}
              >
                Continuar <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          )}

          {/* Step 3: Pillars */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div>
                <p className="text-sm text-primary font-body font-medium mb-1">Passo 3 de 3</p>
                <h2 className="text-3xl font-display font-bold text-foreground">Seus pilares de conteúdo</h2>
                <p className="text-muted-foreground font-body mt-2">
                  Pilares são os temas que você aborda. Escolha entre 3 e 5.
                </p>
              </div>

              {/* Selected pillars */}
              {pillars.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pillars.map((p, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-body font-medium text-primary-foreground"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name}
                      <button onClick={() => removePillar(i)}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Presets */}
              <div className="space-y-2">
                <Label className="font-body text-sm">Sugestões para {niche || "você"}</Label>
                <div className="flex flex-wrap gap-2">
                  {presets.map(name => (
                    <button
                      key={name}
                      onClick={() => addPresetPillar(name)}
                      disabled={pillars.length >= 5 || !!pillars.find(p => p.name === name)}
                      className="px-3 py-1.5 rounded-xl text-sm font-body bg-card border border-border hover:bg-accent disabled:opacity-40 transition-colors"
                    >
                      + {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom pillar */}
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar pilar personalizado..."
                  value={customPillar}
                  onChange={(e) => setCustomPillar(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomPillar()}
                  className="rounded-xl h-10"
                />
                <Button variant="outline" size="icon" onClick={addCustomPillar} disabled={pillars.length >= 5}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full"
                disabled={pillars.length < 3}
                onClick={finishOnboarding}
              >
                Entrar no meu estúdio → ✨
              </Button>
              {pillars.length < 3 && (
                <p className="text-sm text-muted-foreground font-body text-center">
                  Escolha pelo menos 3 pilares para continuar
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;

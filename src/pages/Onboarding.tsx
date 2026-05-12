import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Loader2,
  Sparkles,
  AtSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sanitizeText } from "@/lib/sanitize";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { PILLAR_COLORS } from "@/lib/constants";
import { fireConfetti } from "@/lib/confetti";

const TOTAL_STEPS = 5;

type NicheOption = { value: string; emoji: string };

const NICHE_OPTIONS: NicheOption[] = [
  { value: "Lifestyle", emoji: "🌿" },
  { value: "Moda", emoji: "👗" },
  { value: "Beleza", emoji: "💄" },
  { value: "Fitness", emoji: "💪" },
  { value: "Gastronomia", emoji: "🍳" },
  { value: "Educação", emoji: "📚" },
  { value: "Tecnologia", emoji: "💻" },
  { value: "Finanças", emoji: "💰" },
  { value: "Empreendedorismo", emoji: "🚀" },
  { value: "Viagem", emoji: "✈️" },
  { value: "Maternidade", emoji: "👶" },
  { value: "Saúde Mental", emoji: "🧠" },
  { value: "Pet", emoji: "🐾" },
  { value: "Música", emoji: "🎵" },
  { value: "Arte", emoji: "🎨" },
  { value: "Humor", emoji: "😂" },
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
];

const GOAL_OPTIONS = [1, 2, 3, 5, 7] as const;

const GOAL_LABELS: Record<number, string> = {
  1: "Tranquilo e consistente 🌱",
  2: "Bom ritmo 💪",
  3: "Consistente e sustentável ✨",
  5: "Dedicação total 🔥",
  7: "Todo dia! Máquina 🚀",
};

const DEFAULT_HABITS = [
  "Postei conteúdo hoje?",
  "Respondi comentários?",
  "Gravei algo novo?",
];

type AISetupResult = {
  pilares: { name: string; color: string }[];
  habitos: string[];
  ideias: { title: string; format?: string; platform?: string }[];
};

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateProfile } = useProfile();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [niches, setNiches] = useState<string[]>([]);
  const [customNiche, setCustomNiche] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState<number>(3);

  const [setupLoading, setSetupLoading] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const setupStartedRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "C";

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview((ev.target?.result as string) ?? null);
    reader.readAsDataURL(file);
  };

  const toggleNiche = (value: string) => {
    setNiches((prev) => (prev.includes(value) ? prev.filter((n) => n !== value) : [...prev, value]));
  };

  const addCustomNiche = () => {
    const v = sanitizeText(customNiche).trim();
    if (!v) return;
    if (!niches.includes(v)) setNiches((prev) => [...prev, v]);
    setCustomNiche("");
  };

  const togglePlatform = (id: string) => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(1, s - 1));
  };

  const canAdvance = (() => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return niches.length > 0;
    if (step === 3) return platforms.length > 0;
    if (step === 4) return weeklyGoal > 0;
    return false;
  })();

  const uploadAvatar = useCallback(async (): Promise<string | null> => {
    if (!avatarFile || !user) return null;
    const ext = (avatarFile.name.split(".").pop() ?? "png").toLowerCase();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
    if (error) {
      console.error("Avatar upload failed", error);
      return null;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }, [avatarFile, user]);

  const runSetup = useCallback(async () => {
    if (!user || setupStartedRef.current) return;
    setupStartedRef.current = true;
    setSetupLoading(true);
    setSetupError(null);
    try {
      const sanitizedName = sanitizeText(name);
      const sanitizedHandle = sanitizeText(handle.replace(/^@/, ""));
      const avatarUrl = await uploadAvatar();

      let result: AISetupResult | null = null;
      try {
        const raw = await callAIContextBuilder({
          userId: user.id,
          operation: "onboarding-setup",
          data: {
            nicho: niches.join(", "),
            nichos: niches,
            plataformas: platforms,
            meta_semanal: weeklyGoal,
          },
        });
        if (typeof raw === "string") {
          const cleaned = raw.replace(/```json?\n?|\n?```/g, "").trim();
          try {
            result = JSON.parse(cleaned) as AISetupResult;
          } catch {
            result = null;
          }
        } else if (raw && typeof raw === "object") {
          result = raw as AISetupResult;
        }
      } catch (e) {
        console.warn("AI onboarding-setup failed; using defaults", e);
      }

      const pillarsToCreate = (result?.pilares ?? []).slice(0, 5).map((p, i) => ({
        name: sanitizeText(p.name),
        color: p.color || PILLAR_COLORS[i % PILLAR_COLORS.length],
      })).filter((p) => p.name);
      const fallbackPillars = niches.slice(0, 3).map((n, i) => ({
        name: n,
        color: PILLAR_COLORS[i % PILLAR_COLORS.length],
      }));
      const finalPillars = pillarsToCreate.length > 0 ? pillarsToCreate : fallbackPillars;

      const habitsToCreate = (result?.habitos ?? DEFAULT_HABITS)
        .slice(0, 3)
        .map((h) => sanitizeText(String(h)))
        .filter(Boolean);

      const ideasToCreate = (result?.ideias ?? []).slice(0, 5).map((idea) => ({
        title: sanitizeText(idea.title),
        format: idea.format ?? null,
        platform: idea.platform ?? platforms[0] ?? "instagram",
      })).filter((idea) => idea.title);

      const profileUpdates: Record<string, unknown> = {
        onboarding_completed: true,
        weekly_goal: weeklyGoal,
      };

      if (sanitizedName) profileUpdates.name = sanitizedName;
      if (avatarUrl) profileUpdates.avatar_url = avatarUrl;
      if (sanitizedHandle) profileUpdates.instagram_handle = sanitizedHandle;
      if (niches.length > 0) profileUpdates.niche = niches[0];
      if (platforms.length > 0) profileUpdates.platforms = platforms;

      await updateProfile.mutateAsync(profileUpdates);

      for (let i = 0; i < finalPillars.length; i++) {
        await supabase.from("pillars").insert({
          user_id: user.id,
          name: finalPillars[i].name,
          color: finalPillars[i].color,
          position: i,
        });
      }

      for (let i = 0; i < habitsToCreate.length; i++) {
        await supabase.from("habits").insert({
          user_id: user.id,
          name: habitsToCreate[i],
          position: i,
        });
      }

      for (const idea of ideasToCreate) {
        await supabase.from("ideas").insert({
          user_id: user.id,
          title: idea.title,
        });
      }

      setSetupDone(true);
      fireConfetti();
    } catch (e) {
      console.error("Onboarding setup failed", e);
      setSetupError("Tivemos um problema configurando seu espaço. Você pode tentar de novo.");
      setupStartedRef.current = false;
    } finally {
      setSetupLoading(false);
    }
  }, [user, name, handle, niches, platforms, weeklyGoal, uploadAvatar, updateProfile]);

  useEffect(() => {
    if (step === 5 && !setupStartedRef.current && !setupDone) {
      runSetup();
    }
  }, [step, setupDone, runSetup]);

  const enterApp = () => {
    toast.success("Bem-vindo ao CreatorsFlow! 🎉");
    navigate("/app");
  };

  const slideVariants = {
    enter: (dir: 1 | -1) => ({ opacity: 0, x: dir * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: 1 | -1) => ({ opacity: 0, x: dir * -40 }),
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Progress bar */}
      <div className="sticky top-0 z-20 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <span className="text-base font-display font-extrabold text-foreground">CreatorsFlow</span>
          <div className="flex-1 flex items-center gap-1.5 ml-4">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
              const idx = i + 1;
              const active = idx === step;
              const done = idx < step;
              return (
                <div
                  key={idx}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    active ? "flex-1 bg-primary" : done ? "w-6 bg-primary" : "w-6 bg-muted"
                  )}
                />
              );
            })}
          </div>
          <span className="text-xs font-body text-muted-foreground tabular-nums">
            {step}/{TOTAL_STEPS}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ─── Step 1: Quem é você ─── */}
          {step === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              <header className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground tracking-tight">
                  Quem é você?
                </h1>
                <p className="text-base text-muted-foreground font-body">
                  Vamos começar pelo básico — assim podemos personalizar tudo pra você.
                </p>
              </header>

              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 p-[2px] shrink-0 hover:scale-[1.02] transition-transform"
                  aria-label="Adicionar avatar"
                >
                  <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-display font-extrabold text-primary">{initial}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                    <Camera className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                </button>
                <div className="flex-1">
                  <p className="text-sm font-display font-bold text-foreground">
                    {name.trim() ? `Bem-vindo, ${name.trim()}! 🎉` : "Bem-vindo ao CreatorsFlow 🎉"}
                  </p>
                  <p className="text-xs text-muted-foreground font-body mt-0.5">Toque para adicionar uma foto</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="space-y-2">
                <Label className="font-body text-sm">Como você quer ser chamado?</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome ou apelido"
                  className="rounded-xl h-12"
                  maxLength={60}
                />
              </div>

              <div className="space-y-2">
                <Label className="font-body text-sm">Handle do Instagram (opcional)</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                    placeholder="seuhandle"
                    className="rounded-xl h-12 pl-9"
                    maxLength={40}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── Step 2: Nicho ─── */}
          {step === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              <header className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground tracking-tight">
                  Sobre o que você cria?
                </h1>
                <p className="text-base text-muted-foreground font-body">
                  Escolha um ou mais nichos. A IA usa isso para personalizar tudo.
                </p>
              </header>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {NICHE_OPTIONS.map((n) => {
                  const selected = niches.includes(n.value);
                  return (
                    <button
                      key={n.value}
                      type="button"
                      onClick={() => toggleNiche(n.value)}
                      className={cn(
                        "rounded-2xl border p-3 text-left transition-all hover:scale-[1.02]",
                        selected
                          ? "bg-primary/10 border-primary shadow-warm-sm"
                          : "bg-card border-border hover:border-primary/30"
                      )}
                    >
                      <span className="text-xl block mb-1">{n.emoji}</span>
                      <span className={cn("text-sm font-body font-medium", selected ? "text-primary" : "text-foreground")}>
                        {n.value}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label className="font-body text-xs text-muted-foreground">Outro nicho? Adicione aqui</Label>
                <div className="flex gap-2">
                  <Input
                    value={customNiche}
                    onChange={(e) => setCustomNiche(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomNiche())}
                    placeholder="Ex: Cultura geek, Marketing digital..."
                    className="rounded-xl"
                    maxLength={40}
                  />
                  <Button type="button" variant="outline" onClick={addCustomNiche} disabled={!customNiche.trim()}>
                    Adicionar
                  </Button>
                </div>
                {niches.filter((n) => !NICHE_OPTIONS.find((o) => o.value === n)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {niches
                      .filter((n) => !NICHE_OPTIONS.find((o) => o.value === n))
                      .map((n) => (
                        <span
                          key={n}
                          className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-body px-2 py-1 rounded-full"
                        >
                          {n}
                          <button type="button" onClick={() => toggleNiche(n)} className="hover:text-destructive">
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── Step 3: Plataformas ─── */}
          {step === 3 && (
            <motion.div
              key="step-3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              <header className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground tracking-tight">
                  Onde você posta?
                </h1>
                <p className="text-base text-muted-foreground font-body">
                  Selecione todas as plataformas em que você cria conteúdo.
                </p>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PLATFORMS.map((p) => {
                  const selected = platforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      className={cn(
                        "relative rounded-2xl border p-6 flex flex-col items-center gap-3 transition-all hover:scale-[1.02]",
                        selected
                          ? "bg-primary/10 border-primary shadow-warm-md"
                          : "bg-card border-border hover:border-primary/30"
                      )}
                    >
                      <PlatformIcon platform={p.id} size="lg" />
                      <span className={cn("text-base font-display font-bold", selected ? "text-primary" : "text-foreground")}>
                        {p.label}
                      </span>
                      {selected && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ─── Step 4: Meta semanal ─── */}
          {step === 4 && (
            <motion.div
              key="step-4"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              <header className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground tracking-tight">
                  Sua meta semanal
                </h1>
                <p className="text-base text-muted-foreground font-body">
                  Quantos posts por semana você quer manter? Vamos te ajudar a manter essa consistência.
                </p>
              </header>

              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {GOAL_OPTIONS.map((n) => {
                  const selected = weeklyGoal === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setWeeklyGoal(n)}
                      className={cn(
                        "rounded-2xl border p-4 text-center transition-all hover:scale-[1.03]",
                        selected
                          ? "bg-primary text-primary-foreground border-primary shadow-warm-md"
                          : "bg-card border-border hover:border-primary/30 text-foreground"
                      )}
                    >
                      <span className="block text-3xl font-display font-extrabold">{n}</span>
                      <span className="text-[10px] font-body uppercase tracking-wider opacity-80">por sem.</span>
                    </button>
                  );
                })}
              </div>

              <div className="bg-card rounded-2xl border border-border p-5 text-center">
                <p className="text-sm font-display font-bold text-foreground mb-1">{GOAL_LABELS[weeklyGoal] ?? `${weeklyGoal} posts por semana`}</p>
                <p className="text-xs text-muted-foreground font-body">
                  Você poderá ajustar isso a qualquer momento nas configurações.
                </p>
              </div>
            </motion.div>
          )}

          {/* ─── Step 5: Setup automático ─── */}
          {step === 5 && (
            <motion.div
              key="step-5"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-8 text-center"
            >
              {!setupDone && !setupError && (
                <>
                  <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-purple-600 to-pink-500 opacity-80 animate-pulse" />
                    <div className="absolute inset-1 rounded-full bg-background flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="h-9 w-9 text-primary" strokeWidth={1.5} />
                      </motion.div>
                    </div>
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground tracking-tight mb-3">
                      Preparando seu espaço criativo...
                    </h1>
                    <p className="text-base text-muted-foreground font-body max-w-md mx-auto">
                      A Cria IA está montando seus pilares de conteúdo, hábitos e primeiras ideias com base no que você nos contou.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm font-body text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Isso leva alguns segundos
                  </div>
                </>
              )}

              {setupError && !setupDone && (
                <div className="space-y-4">
                  <p className="text-base font-body text-foreground">{setupError}</p>
                  <Button
                    variant="hero"
                    onClick={() => {
                      setupStartedRef.current = false;
                      runSetup();
                    }}
                  >
                    Tentar novamente
                  </Button>
                </div>
              )}

              {setupDone && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 opacity-90" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="h-12 w-12 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground tracking-tight mb-3">
                      Tudo pronto! 🎉
                    </h1>
                    <p className="text-base text-muted-foreground font-body max-w-md mx-auto">
                      Seu espaço criativo está configurado. Pilares, hábitos e ideias já estão te esperando.
                    </p>
                  </div>
                  <Button variant="hero" size="lg" onClick={enterApp} className="text-base">
                    Entrar no CreatorsFlow <ArrowRight className="ml-1 h-5 w-5" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation footer */}
        {step < TOTAL_STEPS && (
          <div className="mt-12 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={goBack}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            ) : (
              <span />
            )}
            <Button variant="hero" size="lg" onClick={goNext} disabled={!canAdvance}>
              {step === TOTAL_STEPS - 1 ? "Configurar tudo" : "Próximo"} <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;

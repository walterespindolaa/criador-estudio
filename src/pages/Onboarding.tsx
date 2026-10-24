import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { track } from "@/lib/metaPixel";
import { AtSign, Bell, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useSouParceiro } from "@/hooks/useParceiro";
import { useContaAtivaId, useAtualizarPerfilAtivo, caminhoDaConta, type PerfilAtivoPatch } from "@/hooks/useActiveProfile";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateUpload } from "@/lib/upload-validation";
import { sanitizeText } from "@/lib/sanitize";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { PILLAR_COLORS } from "@/lib/constants";
import { fireConfetti } from "@/lib/confetti";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { VoiceInput } from "@/components/shared/VoiceInput";
import { connectInstagram, useSocialConnection } from "@/hooks/useSocialInsights";
import { useQueryClient } from "@tanstack/react-query";
import {
  COR, FORMAS, TelaOnb, TopoOnb, TituloOnb, BotaoOnb, MicroOnb, Bicho, SeloPicotado,
  estiloMarcado, campoOnb, rotuloOnb,
} from "@/components/onboarding/Pecas";

/* ═══════════════════════════════════════════════════════════════════════════
   ONBOARDING DO CRIADOR v3 (24/10/2026, mockup aprovado pelo Walter)

   Uma pergunta por tela, no visual da LP. Oito telas:
     1. Boas-vindas (colagem de post-its; saída pra agência e pra parceiro)
     2. Quem é você      → profiles: name, avatar_url, instagram_handle, phone, cidade
     3. Nicho (até 3)    → profiles.niche
     4. Objetivo (até 3) → brand_items type "objetivo" (Brandbook, aba Quem você é)
     5. Parceiro de escrita = tom de voz → brand_items type "tom" (Brandbook, aba Tom de voz)
     6. Ritmo            → profiles.weekly_goal, profiles.platforms,
                           profiles.notification_prefs.meta_semana (lembrete da meta)
     7. Primeira ideia   → ideas (e, ao entrar nesta tela, a IA monta pilares,
                           hábitos, linha editorial e ideias em segundo plano)
     8. Primeiro selo + a semana montada → entra em /app/ideias

   O público ("pra quem você cria") saiu daqui: era o único campo de texto
   livre e mora na aba Persona do Brandbook.
   ═══════════════════════════════════════════════════════════════════════════ */

const TOTAL_TELAS = 8;
/** Telas com pergunta (2 a 7) contam nas bolinhas do topo. */
const PERGUNTAS = 6;

/* Os valores gravados são os mesmos de antes (o brandbook, a IA e os dados de
   quem já passou pelo onboarding usam estas frases). Só a tela mudou. */
const OBJETIVOS = [
  { valor: "Crescer minha audiência", titulo: "Crescer minha audiência", desc: "Mais gente certa chegando no perfil", cor: COR.azul, forma: FORMAS[2], giro: -6 },
  { valor: "Vender meu produto/serviço", titulo: "Vender meu produto ou serviço", desc: "Conteúdo que leva pra conversa", cor: COR.verde, forma: FORMAS[3], giro: 8 },
  { valor: "Construir autoridade", titulo: "Virar referência no assunto", desc: "Quem pensa no tema, pensa em você", cor: COR.laranja, forma: FORMAS[1], giro: -4 },
  { valor: "Monetizar com marcas", titulo: "Fechar com marcas", desc: "Perfil pronto pra receber proposta", cor: COR.amarelo, forma: FORMAS[4], giro: 10 },
  { valor: "Manter consistência", titulo: "Ter constância", desc: "Postar sem depender de inspiração", cor: COR.rosa, forma: FORMAS[0], giro: -9 },
] as const;

/* Parceiro de escrita = tom de voz. O nome é só a cara; o que grava é o tom. */
const PARCEIROS = [
  { tom: "Descontraído", nome: "Papo", rotulo: "DESCONTRAÍDO", cor: COR.laranja, fundo: "#F9C9B6", forma: FORMAS[0], giro: -6, boca: "M4 4c8 12 24 12 32 0", ono: "oi!", frase: "Bora? Separei três ideias quentinhas pra hoje.", desc: "Fala como amiga. Leve, sem enrolar." },
  { tom: "Profissional", nome: "Prumo", rotulo: "PROFISSIONAL", cor: COR.azul, fundo: "#BCD3F7", forma: "28% 28% 30% 30% / 30% 30% 30% 30%", giro: 0, boca: "M8 9h24", ono: "ok.", frase: "Sua pauta da semana está pronta. Um post por pilar.", desc: "Claro, organizado, direto ao ponto." },
  { tom: "Divertido", nome: "Faísca", rotulo: "DIVERTIDO", cor: COR.amarelo, fundo: "#FBEBA8", forma: FORMAS[1], giro: 8, boca: "M4 2c4 18 28 18 32 0z", ono: "uhu!", frase: "Ideia nova saindo do forno. Cuidado que tá quente.", desc: "Piada no ponto certo, energia lá em cima." },
  { tom: "Inspirador", nome: "Brisa", rotulo: "INSPIRADOR", cor: COR.rosa, fundo: "#FCD2E6", forma: FORMAS[2], giro: -3, boca: "M8 6c6 8 18 8 24 0", ono: "uau", frase: "Toda conta grande começou com um primeiro post.", desc: "Puxa pra cima, conta história, emociona." },
  { tom: "Educativo", nome: "Lousa", rotulo: "EDUCATIVO", cor: COR.verde, fundo: "#BFE6CC", forma: "35% 65% 50% 50% / 45% 50% 50% 55%", giro: 4, boca: "M8 8c6 4 18 4 24 0", ono: "hmm", frase: "Hoje: três erros que travam seu alcance, explicados.", desc: "Explica fácil, passo a passo, sem jargão." },
] as const;

const NICHOS: { valor: string; cor: string }[] = [
  { valor: "Lifestyle", cor: COR.amarelo }, { valor: "Moda", cor: COR.rosa }, { valor: "Beleza", cor: COR.laranja },
  { valor: "Fitness", cor: COR.verde }, { valor: "Gastronomia", cor: COR.laranja }, { valor: "Educação", cor: COR.azul },
  { valor: "Finanças", cor: COR.verde }, { valor: "Empreendedorismo", cor: COR.amarelo }, { valor: "Viagem", cor: COR.azul },
  { valor: "Maternidade", cor: COR.rosa }, { valor: "Pet", cor: COR.amarelo }, { valor: "Humor", cor: COR.laranja },
  { valor: "Saúde Mental", cor: COR.verde }, { valor: "Música", cor: COR.azul }, { valor: "Arte", cor: COR.rosa },
  { valor: "Tecnologia", cor: COR.azul },
];

const PLATAFORMAS = [
  { id: "instagram", rotulo: "Instagram" },
  { id: "tiktok", rotulo: "TikTok" },
  { id: "youtube", rotulo: "YouTube" },
];

const METAS = [1, 2, 3, 5, 7] as const;
const META_ROTULO: Record<number, string> = {
  1: "Tranquilo e consistente", 2: "Bom ritmo", 3: "Constante e sustentável", 5: "Dedicação total", 7: "Todo dia, no talo",
};
const META_COR: Record<number, string> = { 1: COR.verde, 2: COR.verde, 3: COR.azul, 5: COR.laranja, 7: COR.rosa };

const DEFAULT_HABITS = ["Postei conteúdo hoje?", "Respondi comentários?", "Gravei algo novo?"];
const MAX_ESCOLHAS = 3;

type AISetupResult = {
  pilares: { name: string; color: string }[];
  habitos: string[];
  ideias: { title: string; format?: string; platform?: string }[];
};

const Onboarding = () => {
  useForceLightTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile: perfilDaSessao, updateProfile } = useProfile();
  const { data: jaEhParceiro } = useSouParceiro();
  const qc = useQueryClient();
  /* MEU PERFIL (Walter, 18/10/2026). A social mídia cria o Meu perfil e, na
     primeira vez que abre, passa por ESTE onboarding. Tudo que ela responde
     vai pro perfil (dono = ownerId), nunca pra conta de social mídia dela. */
  const { ehMeuPerfil, meuPerfil } = useActiveAccount();
  const { ownerId } = useContaAtivaId();
  const atualizarPerfilAtivo = useAtualizarPerfilAtivo();
  const donoId = ehMeuPerfil ? ownerId : (user?.id ?? "");
  const chaveRascunho = ehMeuPerfil ? `cria.onb.${donoId}` : "cria.onb";

  /* "SOU DESIGNER, EDITOR OU FILMMAKER" (24/09/2026): a RPC troca a conta pra
     parceiro de produção (account_type só muda pelo servidor). */
  const [papeisAbertos, setPapeisAbertos] = useState(false);
  const [virandoParceiro, setVirandoParceiro] = useState(false);
  const virarParceiro = async (papel: string) => {
    setVirandoParceiro(true);
    const { error } = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ error: unknown }>)("tornar_conta_parceiro", { _papel: papel });
    if (error) {
      console.error("[onboarding] tornar_conta_parceiro:", error);
      toast.error("Não consegui trocar sua conta agora. Tenta de novo em instantes.");
      setVirandoParceiro(false);
      return;
    }
    try { sessionStorage.removeItem("cria.onb"); } catch { /* segue */ }
    await qc.invalidateQueries({ queryKey: ["profile"] });
    navigate("/socialmidia/demandas", { replace: true });
  };

  /* RASCUNHO QUE SOBREVIVE À IDA AO INSTAGRAM (v2, 23/09/2026). Conectar o
     Instagram sai do app e volta; o rascunho fica no sessionStorage. */
  const rascunho = (() => {
    try { return JSON.parse(sessionStorage.getItem(chaveRascunho) ?? "null") as Record<string, unknown> | null; } catch { return null; }
  })();
  const [searchParams] = useSearchParams();
  const stepDaUrl = Number(searchParams.get("step") ?? 0);
  const voltouDoInstagram = searchParams.get("ig") === "connected";
  const erroDoInstagram = searchParams.get("ig") === "error";

  const [step, setStep] = useState(stepDaUrl >= 1 && stepDaUrl <= 6 ? stepDaUrl : 1);
  const [direction, setDirection] = useState<1 | -1>(1);

  const [name, setName] = useState((rascunho?.name as string) ?? "");
  const [handle, setHandle] = useState((rascunho?.handle as string) ?? "");
  const [telefone, setTelefone] = useState((rascunho?.telefone as string) ?? "");
  const [cidade, setCidade] = useState((rascunho?.cidade as string) ?? "");
  const [maisAberto, setMaisAberto] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [niches, setNiches] = useState<string[]>((rascunho?.niches as string[]) ?? []);
  const [customNiche, setCustomNiche] = useState("");
  const [platforms, setPlatforms] = useState<string[]>((rascunho?.platforms as string[]) ?? ["instagram"]);
  const [objetivos, setObjetivos] = useState<string[]>(() => {
    const r = rascunho?.objetivos ?? rascunho?.objetivo;
    if (Array.isArray(r)) return (r as string[]).slice(0, MAX_ESCOLHAS);
    return typeof r === "string" && r ? [r] : [];
  });
  const [parceiro, setParceiro] = useState<number>(() => {
    const i = PARCEIROS.findIndex((x) => x.tom === rascunho?.tom);
    return i >= 0 ? i : 0;
  });
  const tom = PARCEIROS[parceiro].tom;
  const [weeklyGoal, setWeeklyGoal] = useState<number>((rascunho?.weeklyGoal as number) ?? 3);
  const [lembrete, setLembrete] = useState<boolean>((rascunho?.lembrete as boolean) ?? true);
  const [primeiraIdeia, setPrimeiraIdeia] = useState("");
  const [ideiaSugerida, setIdeiaSugerida] = useState(0);
  const [guardandoIdeia, setGuardandoIdeia] = useState(false);
  const { data: igConexao } = useSocialConnection();
  const igConectado = !!igConexao || voltouDoInstagram;

  // Nome já veio do cadastro: não pedir de novo.
  useEffect(() => {
    if (name.trim()) return;
    const doCadastro = ehMeuPerfil
      ? meuPerfil?.name?.trim()
      : (perfilDaSessao?.name?.trim() || (user?.user_metadata?.name as string | undefined)?.trim());
    if (doCadastro) setName(doCadastro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ehMeuPerfil, meuPerfil?.name, perfilDaSessao?.name]);

  useEffect(() => {
    if (voltouDoInstagram) toast.success("Instagram conectado. Bora continuar.");
    if (erroDoInstagram) toast.error("Não deu pra conectar o Instagram agora. Dá pra tentar depois em Insights.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(chaveRascunho, JSON.stringify({ name, handle, telefone, cidade, niches, platforms, objetivos, tom, weeklyGoal, lembrete }));
    } catch { /* modo privado */ }
  }, [chaveRascunho, name, handle, telefone, cidade, niches, platforms, objetivos, tom, weeklyGoal, lembrete]);

  const conectarInstagramAgora = () => {
    void connectInstagram(null, `/onboarding?step=${step}`, ehMeuPerfil ? donoId : null);
  };

  const [setupLoading, setSetupLoading] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [generatedIdeas, setGeneratedIdeas] = useState<{ title: string; format?: string | null }[]>([]);
  const setupStartedRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const primeiroNome = name.trim().split(" ")[0] ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "C";

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validation = validateUpload(file, "avatar");
    if (!validation.ok) { toast.error(validation.reason); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawImageSrc((ev.target?.result as string) ?? null);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarCropped = (croppedBlob: Blob) => {
    const cropped = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
    setAvatarFile(cropped);
    setAvatarPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(croppedBlob);
    });
    setRawImageSrc(null);
  };

  const alternarAte3 = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter((n) => n !== valor) : lista.length >= MAX_ESCOLHAS ? lista : [...lista, valor];

  const toggleNiche = (value: string) => {
    if (!niches.includes(value) && niches.length >= MAX_ESCOLHAS) { toast("Até três nichos. Desmarque um pra trocar."); return; }
    setNiches((prev) => alternarAte3(prev, value));
  };
  const addCustomNiche = () => {
    const v = sanitizeText(customNiche).trim();
    if (!v) return;
    if (!niches.includes(v) && niches.length >= MAX_ESCOLHAS) { toast("Até três nichos. Desmarque um pra trocar."); return; }
    if (!niches.includes(v)) setNiches((prev) => [...prev, v]);
    setCustomNiche("");
  };
  const toggleObjetivo = (o: string) => {
    if (!objetivos.includes(o) && objetivos.length >= MAX_ESCOLHAS) { toast("Até três objetivos. Desmarque um pra trocar."); return; }
    setObjetivos((prev) => alternarAte3(prev, o));
  };
  const togglePlatform = (id: string) => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const irPara = (n: number) => {
    setDirection(n > step ? 1 : -1);
    setStep(Math.max(1, Math.min(TOTAL_TELAS, n)));
    window.scrollTo({ top: 0 });
  };
  const goNext = () => irPara(step + 1);
  const goBack = () => irPara(step - 1);

  const uploadAvatar = useCallback(async (): Promise<string | null> => {
    if (!avatarFile || !user) return null;
    const ext = (avatarFile.name.split(".").pop() ?? "png").toLowerCase();
    const path = ehMeuPerfil ? caminhoDaConta(user.id, donoId, `avatar.${ext}`) : `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
    if (error) { console.error("Avatar upload failed", error); return null; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }, [avatarFile, user, ehMeuPerfil, donoId]);

  /* A IA trabalha ENQUANTO a pessoa escreve a primeira ideia (tela 7). Antes
     era uma tela inteira de "Preparando seu espaço..." parada. */
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
            objetivo: objetivos.length ? objetivos.join(", ") : undefined,
            tom: tom || undefined,
          },
        });
        if (typeof raw === "string") {
          const cleaned = raw.replace(/```json?\n?|\n?```/g, "").trim();
          try { result = JSON.parse(cleaned) as AISetupResult; } catch { result = null; }
        } else if (raw && typeof raw === "object") {
          result = raw as AISetupResult;
        }
      } catch (e) {
        console.warn("AI onboarding-setup failed; using defaults", e);
      }

      const pillarsToCreate = (result?.pilares ?? []).slice(0, 5).map((x, i) => ({
        name: sanitizeText(x.name),
        color: x.color || PILLAR_COLORS[i % PILLAR_COLORS.length],
      })).filter((x) => x.name);
      const fallbackPillars = niches.slice(0, 3).map((n, i) => ({ name: n, color: PILLAR_COLORS[i % PILLAR_COLORS.length] }));
      const finalPillars = pillarsToCreate.length > 0 ? pillarsToCreate : fallbackPillars;

      const habitsToCreate = (result?.habitos ?? DEFAULT_HABITS).slice(0, 3).map((h) => sanitizeText(String(h))).filter(Boolean);

      const ideasToCreate = (result?.ideias ?? []).slice(0, 5).map((idea) => ({
        title: sanitizeText(idea.title),
        format: idea.format ?? null,
        platform: idea.platform ?? platforms[0] ?? "instagram",
      })).filter((idea) => idea.title);

      setGeneratedIdeas(ideasToCreate.map(({ title, format }) => ({ title, format })));

      const profileUpdates: Record<string, unknown> = { onboarding_completed: true, weekly_goal: weeklyGoal };
      if (sanitizedName) profileUpdates.name = sanitizedName;
      if (avatarUrl) profileUpdates.avatar_url = avatarUrl;
      if (sanitizedHandle) profileUpdates.instagram_handle = sanitizedHandle;
      if (niches.length > 0) profileUpdates.niche = niches.map((n) => n.trim()).filter(Boolean).join(", ");
      if (platforms.length > 0) profileUpdates.platforms = platforms;

      if (ehMeuPerfil) {
        await atualizarPerfilAtivo.mutateAsync(profileUpdates as PerfilAtivoPatch);
      } else {
        /* LEMBRETE DA META (onboarding v3). Mora nas preferências de
           notificação (ausente = ligado), a mesma chave que o robô diário lê
           e que a pessoa troca depois em Configurações > Notificações. */
        const prefsAtuais = ((perfilDaSessao as unknown as { notification_prefs?: Record<string, boolean> } | null)?.notification_prefs) ?? {};
        const prefs: Record<string, boolean> = { ...prefsAtuais };
        if (lembrete) delete prefs.meta_semana; else prefs.meta_semana = false;
        profileUpdates.notification_prefs = prefs;
        await updateProfile.mutateAsync(profileUpdates);
      }

      // Contato de quem está logado (best-effort: não trava o onboarding).
      const tel = telefone.replace(/[^\d+]/g, "");
      const cid = sanitizeText(cidade.trim()).slice(0, 80);
      if (tel.length >= 10 || cid) {
        const contato: Record<string, string> = {};
        if (tel.length >= 10) contato.phone = tel;
        if (cid) contato.cidade = cid;
        const { error: contatoErr } = await supabase.from("profiles").update(contato as never).eq("id", user.id);
        if (contatoErr) console.warn("[onboarding] contato não salvou", contatoErr.message);
      }

      if (finalPillars.length > 0) {
        const { data: pilaresCriados, error: pillarsErr } = await supabase.from("pillars").insert(
          finalPillars.map((x, i) => ({ user_id: donoId, name: x.name, color: x.color, position: i }))
        ).select("id");
        if (pillarsErr) console.warn("[onboarding] pillars batch insert failed:", pillarsErr);
        /* LINHA EDITORIAL JÁ PREENCHIDA (v2): seg a sex em rodízio. */
        const ids = (pilaresCriados ?? []).map((r) => (r as { id: string }).id);
        if (ids.length > 0) {
          const dias = ["SEG", "TER", "QUA", "QUI", "SEX"];
          const linha: Record<string, string> = {};
          dias.forEach((d, i) => { linha[d] = ids[i % ids.length]; });
          if (ehMeuPerfil) await atualizarPerfilAtivo.mutateAsync({ editorial_line: linha });
          else await supabase.from("profiles").update({ editorial_line: linha } as never).eq("id", user.id);
        }
      }

      /* Tom e objetivos viram itens do brandbook, os mesmos lugares que o
         Brandbook mostra e que a IA lê (useBrandContext). */
      const marcaItens: { user_id: string; type: string; name: string }[] = [];
      if (tom) marcaItens.push({ user_id: donoId, type: "tom", name: tom });
      for (const o of objetivos) marcaItens.push({ user_id: donoId, type: "objetivo", name: o });
      if (marcaItens.length > 0) {
        const { error: eMarca } = await supabase.from("brand_items").insert(marcaItens as never);
        if (eMarca) console.warn("[onboarding] brand_items insert failed:", eMarca);
      }

      if (habitsToCreate.length > 0) {
        const { error: habitsErr } = await supabase.from("habits").insert(
          habitsToCreate.map((hName, i) => ({ user_id: donoId, name: hName, position: i }))
        );
        if (habitsErr) console.warn("[onboarding] habits batch insert failed:", habitsErr);
      }

      if (ideasToCreate.length > 0) {
        const { error: ideasErr } = await supabase.from("ideas").insert(
          ideasToCreate.map((idea) => ({ user_id: donoId, title: idea.title, platform: idea.platform }))
        );
        if (ideasErr) console.warn("[onboarding] ideas batch insert failed:", ideasErr);
      }

      await qc.invalidateQueries();
      setSetupDone(true);
    } catch (e) {
      console.error("Onboarding setup failed", e);
      setSetupError("Tive um problema montando seu estúdio. Tenta de novo?");
      setupStartedRef.current = false;
    } finally {
      setSetupLoading(false);
    }
  }, [user, name, handle, telefone, cidade, niches, platforms, weeklyGoal, objetivos, tom, lembrete, uploadAvatar, updateProfile, perfilDaSessao, ehMeuPerfil, donoId, atualizarPerfilAtivo, qc]);

  useEffect(() => {
    if (step === 7 && !setupStartedRef.current && !setupDone) void runSetup();
  }, [step, setupDone, runSetup]);

  useEffect(() => {
    if (step === 8 && setupDone) fireConfetti();
  }, [step, setupDone]);

  const nichoBase = (niches[0] ?? "").toLowerCase();
  const IDEIAS_SUGERIDAS = [
    `Minha rotina real de ${nichoBase || "criação"} em 60 segundos`,
    `3 erros que eu cometi no começo em ${nichoBase || "meu nicho"}`,
    "Antes e depois: como eu fazia e como faço hoje",
  ];

  /* A primeira ideia é dela, não da IA: entra no banco de ideias antes das
     geradas aparecerem na tela final. */
  const guardarIdeia = async () => {
    const texto = sanitizeText(primeiraIdeia.trim());
    if (!texto) { goNext(); return; }
    if (!donoId) return;
    setGuardandoIdeia(true);
    const titulo = texto.length > 120 ? `${texto.slice(0, 117).trimEnd()}...` : texto;
    const { error } = await supabase.from("ideas").insert({
      user_id: donoId, title: titulo, notes: texto.length > 120 ? texto : null, platform: platforms[0] ?? "instagram",
    } as never);
    setGuardandoIdeia(false);
    if (error) { toast.error("Não consegui guardar a ideia. Tenta de novo?"); return; }
    goNext();
  };

  const enterApp = () => {
    if (!ehMeuPerfil) track("StartTrial", { content_name: "onboarding_complete" });
    try { sessionStorage.removeItem(chaveRascunho); } catch { /* ok */ }
    /* TERMINA NUM ARTEFATO (v2): cai nas ideias, sem tour nesta sessão. */
    try { sessionStorage.setItem("cria.tour-adiado", "1"); } catch { /* ok */ }
    navigate("/app/ideias");
  };

  const slideVariants = {
    enter: (dir: 1 | -1) => ({ opacity: 0, x: dir * 32 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: 1 | -1) => ({ opacity: 0, x: dir * -32 }),
  };
  const anim = { custom: direction, variants: slideVariants, initial: "enter", animate: "center", exit: "exit", transition: { duration: 0.22 } } as const;

  const p = PARCEIROS[parceiro];
  const ideiasFinais = [
    ...(primeiraIdeia.trim() ? [primeiraIdeia.trim()] : []),
    ...generatedIdeas.map((i) => i.title),
  ].slice(0, 3);
  const mostrarSaidas = !ehMeuPerfil && !jaEhParceiro;

  /* ───────────────────────── rodapé de cada tela ───────────────────────── */
  const rodape = (() => {
    switch (step) {
      case 1: return (
        <>
          <BotaoOnb onClick={goNext}>Bora começar</BotaoOnb>
          {mostrarSaidas && (
            <p className="m-0 text-center text-[13px]" style={{ color: COR.apagado }}>
              Gerencia clientes? <Link to="/comecar-agencia" className="font-bold underline underline-offset-2" style={{ color: COR.tinta }}>Sou social mídia ou agência</Link>
            </p>
          )}
        </>
      );
      case 2: return (<><BotaoOnb onClick={goNext} disabled={!name.trim()}>Continuar</BotaoOnb><MicroOnb>Leva um minuto. Dá pra mudar tudo depois.</MicroOnb></>);
      case 3: return (<><BotaoOnb onClick={goNext} disabled={niches.length === 0}>Continuar</BotaoOnb><MicroOnb>{niches.length} de 3 escolhidos · Dá pra mudar depois.</MicroOnb></>);
      case 4: return (<><BotaoOnb onClick={goNext}>Continuar</BotaoOnb><MicroOnb>Escolha até três. Dá pra mudar depois.</MicroOnb></>);
      case 5: return (<><BotaoOnb onClick={goNext}>Quero o {p.nome}</BotaoOnb><MicroOnb>Dá pra trocar quando quiser, no Brandbook.</MicroOnb></>);
      case 6: return (<><BotaoOnb onClick={goNext} disabled={platforms.length === 0}>Fechar meu ritmo</BotaoOnb><MicroOnb>Melhor 2 que você cumpre do que 7 que você abandona.</MicroOnb></>);
      case 7: return (
        <>
          <BotaoOnb onClick={() => void guardarIdeia()} disabled={guardandoIdeia}>
            {guardandoIdeia ? <Loader2 className="h-5 w-5 animate-spin" /> : primeiraIdeia.trim() ? "Guardar minha ideia" : "Pular por agora"}
          </BotaoOnb>
          <MicroOnb>Ela vai direto pro seu banco de ideias.</MicroOnb>
        </>
      );
      case 8: return (
        <>
          <BotaoOnb onClick={enterApp} disabled={!setupDone}>
            {setupDone ? "Abrir meu estúdio" : <><Loader2 className="h-5 w-5 animate-spin" /> Terminando de montar...</>}
          </BotaoOnb>
          <MicroOnb>Sua coleção de selos cresce conforme você posta.</MicroOnb>
        </>
      );
      default: return null;
    }
  })();

  const topo = step >= 2 && step <= 7 ? (
    <TopoOnb passo={step - 1} total={PERGUNTAS}
      onVoltar={step === 7 && setupStartedRef.current ? undefined : goBack}
      onPular={step === 4 ? goNext : undefined} />
  ) : null;

  return (
    <TelaOnb rodape={rodape}>
      {topo}
      <AnimatePresence mode="wait" custom={direction}>

        {/* ─── 1. Boas-vindas ─── */}
        {step === 1 && (
          <motion.div key="t1" {...anim} className="relative flex min-h-[calc(100dvh-180px)] flex-col">
            <span aria-hidden="true" className="absolute left-1/2 top-[30%] h-[280px] w-[300px] -translate-x-1/2" style={{ background: "#FBE39A", borderRadius: FORMAS[0] }} />
            <div className="absolute -left-2 top-16 w-[132px] -rotate-[8deg] p-3.5 shadow-[0_6px_14px_rgba(10,10,10,0.12)]" style={{ background: COR.amarelo, fontFamily: "'Grand Hotel', cursive", fontSize: 21, lineHeight: 1.05 }}>
              <span aria-hidden="true" className="absolute -top-1.5 left-[58px] h-3.5 w-3.5 rounded-full" style={{ background: COR.laranja }} />
              Gravar o reels de terça
            </div>
            <div className="absolute -right-3 top-[150px] w-[130px] rotate-[7deg] p-3.5 shadow-[0_6px_14px_rgba(10,10,10,0.12)]" style={{ background: COR.rosa, fontFamily: "'Grand Hotel', cursive", fontSize: 21, lineHeight: 1.05 }}>
              3 ideias pro Dia das Mães
            </div>
            <div className="absolute -right-1.5 top-[62%] flex -rotate-[5deg] items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-semibold shadow-[0_6px_14px_rgba(10,10,10,0.12)]" style={{ background: COR.papel }}>
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full" style={{ background: COR.verde }}><Check className="h-3 w-3 text-white" strokeWidth={4} /></span>
              Post aprovado
            </div>
            <img src="/stickers/selo-social-club-azul.png" alt="" className="absolute right-5 top-2 w-[74px] rotate-12" />
            <img src="/stickers/selo-sem-formula.png" alt="" className="absolute -left-4 top-[56%] w-[112px] -rotate-12" />

            <div className="relative font-display text-[34px] font-extrabold tracking-[-1px]">cria<span style={{ color: COR.laranja }}>.</span></div>
            <div className="relative mt-auto flex flex-col items-center pb-2 text-center">
              <h1 className="m-0 font-display text-[32px] font-extrabold leading-[1.02] tracking-[-0.5px]">
                {ehMeuPerfil
                  ? <>Seu lado criadora <span style={{ color: COR.laranja }}>começa aqui.</span></>
                  : <>Suas ideias, roteiros e posts. Tudo começa <span style={{ color: COR.laranja }}>aqui.</span></>}
              </h1>
              <svg aria-hidden="true" width="80" height="90" viewBox="0 0 90 110" fill="none" stroke={COR.tinta} strokeWidth="2.2" strokeLinecap="round" className="mt-1">
                <path d="M44 4c-2 18 8 22 20 18 12-5 8-20-6-16-16 5-18 34-16 78" /><path d="M32 88l10 14 12-13" />
              </svg>
              {mostrarSaidas && (
                <div className="w-full">
                  <button type="button" onClick={() => setPapeisAbertos((v) => !v)} className="min-h-11 text-[13px] font-semibold underline underline-offset-2">Sou designer, editor ou filmmaker</button>
                  {papeisAbertos && (
                    <div className="mt-1 rounded-2xl border-2 p-3 text-left" style={{ background: COR.papel, borderColor: COR.borda }}>
                      <p className="m-0 text-xs" style={{ color: COR.apagado }}>O que você faz pras agências? Sua conta vira de parceiro de produção (sem mensalidade).</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {([["designer", "Design"], ["editor_video", "Edição de vídeo"], ["filmmaker", "Captação / filmmaker"], ["copy", "Copy"], ["trafego", "Tráfego"]] as const).map(([k, l]) => (
                          <button key={k} type="button" disabled={virandoParceiro} onClick={() => void virarParceiro(k)}
                            className="min-h-10 rounded-full border-2 px-3.5 text-sm font-semibold disabled:opacity-50" style={estiloMarcado(false)}>{l}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── 2. Quem é você ─── */}
        {step === 2 && (
          <motion.div key="t2" {...anim}>
            <div className="mt-2 flex flex-col items-center">
              <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Adicionar foto"
                className="relative grid h-[104px] w-[104px] place-items-center font-display text-[42px] font-extrabold"
                style={{ background: COR.amarelo, borderRadius: FORMAS[0] }}>
                {avatarPreview ? <img src={avatarPreview} alt="" className="h-full w-full object-cover" style={{ borderRadius: FORMAS[0] }} /> : initial}
                <span className="absolute bottom-1 right-0 grid h-[34px] w-[34px] place-items-center rounded-full" style={{ background: COR.tinta }}>
                  <Camera className="h-4 w-4" style={{ color: COR.papel }} />
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <TituloOnb antes={primeiroNome ? `Oi, ${primeiroNome}!` : "Prazer, eu sou o Cria."} sub="Começa pelo básico. Toca na bolha pra pôr sua foto." />
            </div>

            <div className="mt-6 flex flex-col gap-3.5">
              <div>
                <label className={rotuloOnb} htmlFor="onb-nome">Como a gente te chama?</label>
                <input id="onb-nome" className={campoOnb} value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome ou apelido" maxLength={60} autoComplete="given-name" />
              </div>

              <div className="flex items-center gap-3 rounded-[20px] border-2 p-3.5" style={{ background: COR.papel, borderColor: igConectado ? COR.verde : COR.borda }}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px]" style={{ background: COR.rosa }}>
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COR.tinta} strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill={COR.tinta} /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-display text-[15px] font-bold">{igConectado ? (igConexao?.username ? `@${igConexao.username} conectado` : "Instagram conectado") : "Conecte seu Instagram"}</p>
                  <p className="m-0 mt-0.5 text-[12.5px] leading-snug" style={{ color: COR.apagado }}>{igConectado ? "Seus números já entram no app." : "Conta profissional. Leva 20 segundos e volta pra cá."}</p>
                </div>
                {igConectado
                  ? <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: COR.verde }}><Check className="h-5 w-5" strokeWidth={3} /></span>
                  : <button type="button" onClick={conectarInstagramAgora} className="h-11 shrink-0 rounded-full px-4 font-display text-sm font-bold" style={{ background: COR.tinta, color: COR.papel }}>Conectar</button>}
              </div>

              {!igConectado && (
                <div>
                  <label className={rotuloOnb} htmlFor="onb-arroba">Ou só o seu @ por enquanto</label>
                  <div className="relative">
                    <AtSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: COR.apagado }} />
                    <input id="onb-arroba" className={`${campoOnb} pl-10`} value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))} placeholder="seuperfil" maxLength={40} autoCapitalize="none" />
                  </div>
                </div>
              )}

              <button type="button" onClick={() => setMaisAberto((v) => !v)} className="flex min-h-11 items-center gap-1.5 text-left text-[13.5px] font-semibold" style={{ color: "#4A463D" }}>
                <ChevronDown className={`h-4 w-4 transition-transform ${maisAberto ? "rotate-180" : ""}`} strokeWidth={2.6} />
                WhatsApp e cidade (opcional)
              </button>
              {maisAberto && (
                <div className="flex gap-2.5">
                  <input className={campoOnb} style={{ flex: 1.2 }} value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="(47) 99999-0000" aria-label="WhatsApp" maxLength={20} />
                  <input className={campoOnb} style={{ flex: 1 }} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Itajaí, SC" aria-label="Cidade" maxLength={80} />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── 3. Nicho ─── */}
        {step === 3 && (
          <motion.div key="t3" {...anim}>
            <TituloOnb antes="Sobre o que você" destaque="cria?" sub="Escolha até três. A IA usa isso pra pensar ideias do seu nicho." />
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {[...NICHOS, ...niches.filter((n) => !NICHOS.some((x) => x.valor === n)).map((v) => ({ valor: v, cor: COR.laranja }))].map((n, i) => {
                const on = niches.includes(n.valor);
                return (
                  <button key={n.valor} type="button" onClick={() => toggleNiche(n.valor)} aria-pressed={on}
                    className="flex min-h-[46px] items-center gap-2 rounded-full border-2 pl-2.5 pr-4 text-[15px] font-semibold transition-transform"
                    style={{ ...estiloMarcado(on), transform: on ? `rotate(${i % 2 ? 2 : -2}deg)` : undefined }}>
                    <span aria-hidden="true" className="h-5 w-[22px]" style={{ background: n.cor, borderRadius: FORMAS[i % 3] }} />
                    {n.valor}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <input value={customNiche} onChange={(e) => setCustomNiche(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomNiche(); } }}
                aria-label="Outro nicho" placeholder="Outro? Ex.: cultura geek" maxLength={40}
                className="h-12 min-w-0 flex-1 rounded-full border-2 border-dashed bg-transparent px-[18px] text-[15px] font-medium outline-none" style={{ borderColor: "#C9C2AC" }} />
              <button type="button" onClick={addCustomNiche} aria-label="Adicionar nicho" className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: COR.tinta }}>
                <Plus className="h-[18px] w-[18px]" style={{ color: COR.papel }} strokeWidth={2.6} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── 4. Objetivo ─── */}
        {step === 4 && (
          <motion.div key="t4" {...anim}>
            <TituloOnb antes="O que você quer" destaque="agora?" sub="A gente monta sua primeira semana em cima disso." />
            <div className="mt-6 flex flex-col gap-2.5">
              {OBJETIVOS.map((o) => {
                const on = objetivos.includes(o.valor);
                return (
                  <button key={o.valor} type="button" onClick={() => toggleObjetivo(o.valor)} aria-pressed={on}
                    className="flex min-h-[66px] w-full items-center gap-3 rounded-[20px] border-2 py-2.5 pl-[18px] pr-3 text-left"
                    style={estiloMarcado(on)}>
                    <span className="flex-1">
                      <span className="block font-display text-[16.5px] font-bold leading-tight">{o.titulo}</span>
                      <span className="mt-0.5 block text-[12.5px] opacity-75">{o.desc}</span>
                    </span>
                    <Bicho cor={o.cor} forma={o.forma} giro={o.giro} tamanho={52} />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ─── 5. Parceiro de escrita (tom de voz) ─── */}
        {step === 5 && (
          <motion.div key="t5" {...anim}>
            <TituloOnb antes="Quem escreve" destaque="com você?" sub="É o jeito que a Cria IA vai falar nas suas legendas e roteiros." />
            <div className="relative -mx-5 mt-5 h-[430px]">
              <span aria-hidden="true" className="absolute -left-[200px] top-8 h-[370px] w-[230px] rounded-[32px] opacity-45" style={{ background: PARCEIROS[(parceiro + PARCEIROS.length - 1) % PARCEIROS.length].fundo }} />
              <span aria-hidden="true" className="absolute -right-[200px] top-8 h-[370px] w-[230px] rounded-[32px] opacity-45" style={{ background: PARCEIROS[(parceiro + 1) % PARCEIROS.length].fundo }} />
              <AnimatePresence mode="wait">
                <motion.div key={p.nome} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.18 }}
                  className="absolute inset-x-[50px] top-0 flex h-[430px] flex-col items-center rounded-[32px] px-5 pb-5 pt-6"
                  style={{ background: p.fundo }}>
                  <span className="relative">
                    <Bicho cor={p.cor} forma={p.forma} giro={p.giro} tamanho={150} boca={p.boca} />
                    <span aria-hidden="true" className="absolute -right-6 -top-2 rotate-12 text-2xl" style={{ fontFamily: "'Grand Hotel', cursive" }}>{p.ono}</span>
                  </span>
                  <span className="mt-5 rounded-full px-3 py-1 text-[11.5px] font-bold tracking-[1.4px]" style={{ background: COR.papel }}>{p.rotulo}</span>
                  <p className="m-0 mt-4 min-h-[68px] text-center font-display text-[17px] font-semibold leading-snug">“{p.frase}”</p>
                  <p className="m-0 mt-auto font-display text-[26px] font-extrabold">{p.nome}</p>
                  <p className="m-0 text-[12.5px]" style={{ color: "#3D3A33" }}>{p.desc}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-4 flex items-center justify-center gap-4">
              <button type="button" onClick={() => setParceiro((i) => (i + PARCEIROS.length - 1) % PARCEIROS.length)} aria-label="Parceiro anterior"
                className="grid h-11 w-11 place-items-center rounded-full border-2" style={{ borderColor: COR.tinta, background: COR.papel }}>
                <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.6} />
              </button>
              <div className="flex gap-1.5">
                {PARCEIROS.map((x, k) => (
                  <button key={x.nome} type="button" onClick={() => setParceiro(k)} aria-label={x.nome} className="grid h-6 place-items-center">
                    <span className="block h-2 rounded-full transition-all" style={{ width: k === parceiro ? 22 : 8, background: k === parceiro ? COR.tinta : "#C9C2AC" }} />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setParceiro((i) => (i + 1) % PARCEIROS.length)} aria-label="Próximo parceiro"
                className="grid h-11 w-11 place-items-center rounded-full border-2" style={{ borderColor: COR.tinta, background: COR.papel }}>
                <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.6} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── 6. Ritmo ─── */}
        {step === 6 && (
          <motion.div key="t6" {...anim}>
            <TituloOnb antes="Pouco tempo," destaque="muita constância." sub="Quantos posts por semana cabem na sua vida real?" />
            <div className="relative mx-auto mt-5 h-[200px] w-[200px]">
              <svg aria-hidden="true" width="200" height="200" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="80" fill={COR.papel} stroke={COR.borda} strokeWidth="22" />
                <circle cx="100" cy="100" r="80" fill="none" stroke={META_COR[weeklyGoal] ?? COR.azul} strokeWidth="22" strokeLinecap="round"
                  strokeDasharray={`${((502.65 * weeklyGoal) / 7).toFixed(1)} 502.65`} transform="rotate(-90 100 100)" style={{ transition: "stroke-dasharray .3s" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-[64px] font-extrabold leading-[0.9]">{weeklyGoal}</span>
                <span className="text-[11px] font-bold tracking-[1.5px]" style={{ color: "#4A463D" }}>POSTS / SEMANA</span>
              </div>
            </div>
            <p className="m-0 mt-2.5 text-center font-display text-base font-bold">{META_ROTULO[weeklyGoal]}</p>
            <div role="group" aria-label="Posts por semana" className="mt-3 flex justify-center gap-2">
              {METAS.map((v) => (
                <button key={v} type="button" onClick={() => setWeeklyGoal(v)} aria-pressed={v === weeklyGoal}
                  className="h-12 w-[52px] rounded-2xl border-2 font-display text-xl font-extrabold" style={estiloMarcado(v === weeklyGoal)}>{v}</button>
              ))}
            </div>

            <p className="mb-2 ml-1 mt-5 text-[13px] font-semibold" style={{ color: "#4A463D" }}>Onde você posta?</p>
            <div className="flex gap-2">
              {PLATAFORMAS.map((r) => {
                const on = platforms.includes(r.id);
                return (
                  <button key={r.id} type="button" onClick={() => togglePlatform(r.id)} aria-pressed={on}
                    className="h-[46px] flex-1 rounded-full border-2 text-[14.5px] font-semibold" style={estiloMarcado(on)}>{r.rotulo}</button>
                );
              })}
            </div>

            {!ehMeuPerfil && (
              <div className="mt-3 flex items-center gap-3 rounded-[18px] border-2 py-2.5 pl-3.5 pr-2" style={{ background: COR.papel, borderColor: COR.borda }}>
                <Bell className="h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <p className="m-0 font-display text-[14.5px] font-bold">Um empurrãozinho?</p>
                  <p className="m-0 text-xs leading-snug" style={{ color: COR.apagado }}>Te aviso de manhã quando a meta da semana estiver ficando pra trás.</p>
                </div>
                <button type="button" role="switch" aria-checked={lembrete} aria-label="Lembrete da meta" onClick={() => setLembrete((v) => !v)} className="grid h-11 w-[54px] place-items-center">
                  <span className="relative block h-[30px] w-[50px] rounded-full transition-colors" style={{ background: lembrete ? COR.verde : "#C9C2AC" }}>
                    <span className="absolute top-[3px] h-6 w-6 rounded-full shadow transition-all" style={{ left: lembrete ? 23 : 3, background: COR.papel }} />
                  </span>
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── 7. Primeira ideia (a IA trabalha em paralelo) ─── */}
        {step === 7 && (
          <motion.div key="t7" {...anim}>
            <TituloOnb antes="Começa por" destaque="uma ideia." sub="Não precisa estar pronta. Ideia boa nasce rascunho." />
            <div className="mt-5 rounded-[30px] px-4 pb-4 pt-[18px]" style={{ background: p.fundo }}>
              <div className="mb-3 flex items-end gap-2.5">
                <Bicho cor={p.cor} forma={p.forma} giro={p.giro} tamanho={74} boca={p.boca} />
                <div className="rounded-[18px_18px_18px_4px] px-3.5 py-2.5 font-display text-sm font-semibold leading-snug" style={{ background: COR.papel }}>
                  Joga aqui o que tá na sua cabeça. Eu ajudo a virar post.
                </div>
              </div>
              <label htmlFor="onb-ideia" className="mb-1.5 ml-1 block text-[11px] font-bold tracking-[1.4px]" style={{ color: "#3D3A33" }}>SUA PRIMEIRA IDEIA</label>
              <div className="rounded-[20px] px-3.5 py-3" style={{ background: COR.papel }}>
                <textarea id="onb-ideia" rows={4} maxLength={280} value={primeiraIdeia} onChange={(e) => setPrimeiraIdeia(e.target.value.slice(0, 280))}
                  placeholder="Ex.: mostrar minha rotina de 5 minutos antes do trabalho"
                  className="w-full resize-none border-0 bg-transparent text-[15px] font-medium leading-snug outline-none placeholder:text-[#8A8577]" />
                <div className="flex items-center justify-between">
                  <VoiceInput onTranscript={(t) => setPrimeiraIdeia((prev) => `${prev ? `${prev} ` : ""}${t}`.slice(0, 280))} title="Falar em vez de digitar" />
                  <span className="text-xs" style={{ color: COR.apagado }}>{primeiraIdeia.length} / 280</span>
                </div>
              </div>
              <button type="button" onClick={() => { setPrimeiraIdeia(IDEIAS_SUGERIDAS[ideiaSugerida % IDEIAS_SUGERIDAS.length]); setIdeiaSugerida((n) => n + 1); }}
                className="mt-2.5 flex min-h-11 items-center gap-1.5 rounded-full border-2 border-dashed px-4 font-display text-sm font-bold" style={{ borderColor: COR.tinta }}>
                <Sparkles className="h-4 w-4" /> Travou? Me dá uma ideia
              </button>
            </div>

            <div className="mt-3.5 rounded-[18px] border-2 px-3.5 py-3" style={{ background: COR.papel, borderColor: COR.borda }}>
              <p className="m-0 mb-2 font-display text-[13px] font-bold">Enquanto isso, montando seu estúdio</p>
              {setupError ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="m-0 text-[13px]" style={{ color: COR.laranja }}>{setupError}</p>
                  <button type="button" onClick={() => { setupStartedRef.current = false; void runSetup(); }} className="min-h-10 rounded-full px-3.5 text-sm font-bold" style={{ background: COR.tinta, color: COR.papel }}>Tentar</button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {["Seus pilares de conteúdo", "Seus hábitos da semana", "Suas primeiras ideias"].map((t) => (
                    <div key={t} className="flex items-center gap-2 text-[13px]" style={{ color: setupDone ? COR.tinta : COR.apagado }}>
                      {setupDone
                        ? <span className="grid h-[18px] w-[18px] place-items-center rounded-full" style={{ background: COR.verde }}><Check className="h-2.5 w-2.5 text-white" strokeWidth={4} /></span>
                        : <Loader2 className="mx-0.5 h-3.5 w-3.5 animate-spin" />}
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── 8. Primeiro selo + semana montada ─── */}
        {step === 8 && (
          <motion.div key="t8" {...anim} className="flex flex-col">
            <TituloOnb antes={primeiroNome ? "Bom começo," : "Bom começo."} destaque={primeiroNome ? `${primeiroNome}.` : undefined} sub="Você transformou uma ideia no primeiro passo." className="mt-4" />

            <motion.div initial={{ scale: 1.5, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }} className="mx-auto mt-5">
              <SeloPicotado>
                <span className="flex h-[220px] w-[190px] flex-col p-3 text-left" style={{ background: COR.laranja }}>
                  <span className="text-[9px] font-bold tracking-[1.6px]">CRIA · EDIÇÃO 001</span>
                  <img src="/stickers/selo-da-ideia-ao-post-amarelo.png" alt="" className="m-auto w-[150px] -rotate-[8deg]" />
                  <span className="flex justify-between font-display text-[13px] font-extrabold"><span>PRIMEIRA IDEIA</span><span>001</span></span>
                </span>
              </SeloPicotado>
            </motion.div>

            <p className="mb-2 ml-1 mt-5 text-[11px] font-bold tracking-[1.4px]" style={{ color: "#4A463D" }}>PRÓXIMOS SELOS · NOS SEUS PRIMEIROS PASSOS</p>
            <div className="flex gap-2">
              <span className="flex-1 rounded-[14px] px-2.5 py-2 text-[11.5px] leading-tight" style={{ background: COR.tinta, color: COR.papel }}><b className="block font-display text-sm">001</b>Primeira ideia</span>
              <span className="flex-1 rounded-[14px] border-2 border-dashed px-2.5 py-1.5 text-[11.5px] leading-tight" style={{ borderColor: "#C9C2AC", color: COR.apagado }}><b className="block font-display text-sm">002</b>Primeiro post no ar</span>
              <span className="flex-1 rounded-[14px] border-2 border-dashed px-2.5 py-1.5 text-[11.5px] leading-tight" style={{ borderColor: "#C9C2AC", color: COR.apagado }}><b className="block font-display text-sm">003</b>Link na bio no ar</span>
            </div>

            <div className="mt-3.5 rounded-[20px] border-2 px-3.5 py-3" style={{ background: COR.papel, borderColor: COR.borda }}>
              {setupDone ? (
                <>
                  <p className="m-0 mb-2 font-display text-sm font-bold">{ideiasFinais.length ? `Sua semana já tem ${ideiasFinais.length === 1 ? "1 ideia" : `${ideiasFinais.length} ideias`}` : "Seu estúdio está montado"}</p>
                  {ideiasFinais.length > 0 ? (
                    <div className="flex flex-col gap-1.5 text-[13px]">
                      {ideiasFinais.map((t, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: [COR.rosa, COR.azul, COR.amarelo][i % 3] }} />
                          <span className="min-w-0 truncate">{t}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="m-0 text-[13px]" style={{ color: COR.apagado }}>Pilares, hábitos e linha editorial já estão te esperando.</p>
                  )}
                </>
              ) : setupError ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="m-0 text-[13px]" style={{ color: COR.laranja }}>{setupError}</p>
                  <button type="button" onClick={() => { setupStartedRef.current = false; void runSetup(); }} className="min-h-10 rounded-full px-3.5 text-sm font-bold" style={{ background: COR.tinta, color: COR.papel }}>Tentar</button>
                </div>
              ) : (
                <p className="m-0 flex items-center gap-2 text-[13px]" style={{ color: COR.apagado }}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Separando suas primeiras ideias{setupLoading ? "..." : ""}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {rawImageSrc && (
        <ImageCropModal open={cropModalOpen} onOpenChange={setCropModalOpen} imageSrc={rawImageSrc} onCropComplete={handleAvatarCropped} />
      )}
    </TelaOnb>
  );
};

export default Onboarding;

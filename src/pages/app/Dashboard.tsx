import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Copy, Check, Lightbulb, Repeat2, Sparkles, Video, Instagram, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCriaAI } from "@/contexts/CriaAIContext";
import { useProfile } from "@/hooks/useProfile";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useBrandItems } from "@/hooks/useBrandItems";
import { usePosts, type Post } from "@/hooks/usePosts";
import { useHabits } from "@/hooks/useHabits";
import { useTasks } from "@/hooks/useTasks";
import { useTarefasExtras, type TarefaExtra } from "@/hooks/useTarefasExtras";
import { usePillars } from "@/hooks/usePillars";
import { useTier } from "@/hooks/useTier";
import { useAiUsage } from "@/hooks/useAiUsage";
import { useAcessoCriakut } from "@/hooks/useCriakut";
import { connectInstagram } from "@/hooks/useSocialInsights";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { getThumbnailUrl, type MediaLike } from "@/lib/driveMedia";
import { contarTravas, saiu, somarDias, type Trava } from "@/lib/oQueTrava";
import { cn } from "@/lib/utils";
import { ConviteCriakut } from "@/components/criakut/ConviteCriakut";
import { FirstStepsPanel } from "@/components/dashboard/FirstStepsPanel";
import { WhoYouAre } from "@/components/dashboard/WhoYouAre";
import { CapturaRapidaDialog } from "@/components/dashboard/CapturaRapidaDialog";
import { VitrineStudio } from "@/components/dashboard/AtalhosInicio";
import { NumerosInstagram, useResumoInstagram } from "@/components/dashboard/InstagramPulse";
import { AtalhoInicio, CardInicio, CARTAO_INICIO, FaixaTrava, HojeDoCriador, SemanaDoCriador, type PostSemana } from "@/components/dashboard/InicioBlocos";
import { RepurposeSheet } from "@/components/kanban/RepurposeSheet";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/* ═══════════════════════════════════════════════════════════════════════════
   INÍCIO DO CRIADOR (Walter, 06/11/2026, mockup aprovado)

   A home responde uma pergunta: o que eu faço agora.
     1. Topo: o dia, quanto sai hoje e três atalhos (Nova ideia, Gravar no
        Prompter, Cria IA). Logo embaixo, o que trava (mesma conta do Criando).
     2. Sai esta semana (linha editorial + posts, num bloco só) | Hoje.
     3. Seu Instagram com comparação e o que mais funcionou | Gancho e Cria IA.
     4. Quem é você e o Criakut no fim.
   Saíram da primeira tela: os números de "Meu conteúdo" (o Criando mostra), o
   filtro de período e a próxima ação (o que trava faz esse papel).

   GRADE ÚNICA: 12 colunas a partir de lg, gap de 20px em linha e coluna, e
   cada bloco é um CardInicio (cabeçalho h-14, corpo p-5). Blocos da mesma
   linha têm a mesma altura porque o grid estica e o cartão é h-full. No
   celular, uma coluna só com o mesmo gap.
   ═══════════════════════════════════════════════════════════════════════════ */

const HOOKS_VIRAL = [
  "Você sabia que [dado surpreendente]?",
  "O erro que quase todo mundo comete sem perceber...",
  "3 coisas que eu faria diferente se começasse hoje",
  "Pare de [ação comum] se quiser [resultado]",
  "A verdade que ninguém fala sobre [tema]",
  "Eu gastei [tempo] pra aprender isso, te conto em 60s",
  "Se você [dor do público], esse vídeo é pra você",
  "O segredo que [referência] não te conta",
  "Todo mundo fala pra fazer X, mas ninguém fala que...",
  "Eu perdi [algo] por não saber disso antes",
  "Você está fazendo [ação] errado. Veja porquê.",
  "O que [referência] faz que você não faz",
  "Testei [método] por 30 dias. O resultado me surpreendeu.",
  "5 sinais de que você está [problema]",
  "Por que [crença popular] está ERRADO",
  "Antes vs Depois de eu descobrir [solução]",
  "Se eu pudesse voltar no tempo, diria isso a mim mesmo...",
  "Você NÃO precisa de [coisa cara] pra [resultado]",
  "A fórmula que me ajudou a [resultado] em [tempo]",
  "Me julga, mas eu faço [hábito controverso] e funciona",
];

const GAP = "gap-5";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openCria } = useCriaAI();
  const { temAcesso: temCriakut } = useAcessoCriakut();
  const { isLoading: profileLoading } = useProfile();
  const { profile: activeProfile } = useActiveProfile();
  const { brandItems } = useBrandItems();
  const temTom = brandItems.some((i) => i.type === "tom");
  const { isStudio } = useTier();
  const hoje = useMemo(() => hojeBR(), []);
  const fimSemana = useMemo(() => somarDias(hoje, 6), [hoje]);

  const { posts, createPost } = usePosts();
  const { tasks, createTask } = useTasks({ limit: 200 });
  const { alternar } = useTarefasExtras();
  const { habits, habitLogs, toggleHabitLog } = useHabits({ date: hoje, limit: 20 });
  const { pillars } = usePillars();
  const ia = useAiUsage();
  const insta = useResumoInstagram();

  const [captura, setCaptura] = useState(false);
  const [vitrine, setVitrine] = useState(false);
  const [reaproveitar, setReaproveitar] = useState<Post | null>(null);
  const [copiado, setCopiado] = useState(false);

  /* Posts que ainda contam: os que não saíram, mais os da semana (pra mostrar
     o que já saiu no dia). É sobre eles que a faixa e a semana trabalham. */
  const ativos = useMemo(() => posts.filter((p) => !saiu(p) || (p.scheduled_date && p.scheduled_date.slice(0, 10) >= hoje && p.scheduled_date.slice(0, 10) <= fimSemana)), [posts, hoje, fimSemana]);
  const ids = useMemo(() => ativos.filter((p) => !saiu(p) && p.status !== "ideia").map((p) => p.id).sort(), [ativos]);

  // Primeira mídia de cada post (mesma leitura dos Agendamentos): serve pra
  // prévia da semana e pra saber o que está sem mídia.
  const { data: midias = new Map<string, string | null>() } = useQuery<Map<string, string | null>>({
    queryKey: ["inicio-midias", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sb = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;
      const m = new Map<string, string | null>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await sb("external_media_refs")
          .select("post_id,provider,external_file_id,file_type,thumbnail_url,view_url,download_url,position,created_at")
          .in("post_id", ids.slice(i, i + 200)).eq("substituida", false)
          .order("position", { ascending: true, nullsFirst: true });
        for (const r of ((data as unknown as (MediaLike & { post_id: string })[]) ?? [])) {
          if (m.has(r.post_id) && m.get(r.post_id)) continue;
          m.set(r.post_id, getThumbnailUrl(r, 240));
        }
      }
      return m;
    },
  });
  const comMidia = useMemo(() => new Set(midias.keys()), [midias]);
  const thumbs = useMemo(() => {
    const t = new Map<string, string>();
    midias.forEach((v, k) => { if (v) t.set(k, v); });
    return t;
  }, [midias]);

  const travas = useMemo(() => contarTravas(ativos.filter((p) => !saiu(p)), comMidia, hoje), [ativos, comMidia, hoje]);
  const saiHoje = ativos.filter((p) => !saiu(p) && p.scheduled_date?.slice(0, 10) === hoje).length;
  const praGravar = posts.filter((p) => p.status === "gravando").length;
  const semana = useMemo(() => ativos.filter((p) => {
    const d = p.scheduled_date?.slice(0, 10);
    return !!d && d >= hoje && d <= fimSemana;
  }) as unknown as PostSemana[], [ativos, hoje, fimSemana]);

  /* Hoje: o que vence hoje, o que não tem prazo e o que ficou de ontem pra
     trás, sem fazer. As feitas hoje continuam na lista, riscadas. */
  const tarefasHoje = useMemo(() => {
    const lista = (tasks as TarefaExtra[]).filter((t) => {
      if (t.status === "concluida") return t.due_date === hoje || (!!t.concluida_em && t.concluida_em.slice(0, 10) === hoje);
      return !t.due_date || t.due_date <= hoje;
    });
    return lista.sort((a, b) => Number(a.status === "concluida") - Number(b.status === "concluida")
      || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  }, [tasks, hoje]);
  const feitas = tarefasHoje.filter((t) => t.status === "concluida").length;

  const habitos = habits.map((h) => ({ id: h.id, name: h.name, feito: habitLogs.some((l) => l.habit_id === h.id && l.done) }));

  const dia = parseDateOnly(hoje);
  const dataExtenso = dia.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const diaDoAno = Math.floor((dia.getTime() - new Date(dia.getFullYear(), 0, 0).getTime()) / 86400000);
  const gancho = HOOKS_VIRAL[diaDoAno % HOOKS_VIRAL.length];

  const abrirTrava = (t: Trava) => navigate("/app/criando", { state: { filtroTrava: t } });

  const gravar = () => {
    if (!isStudio) { setVitrine(true); return; }
    navigate("/app/prompter");
  };

  const copiarGancho = async () => {
    try { await navigator.clipboard.writeText(gancho); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { toast.error("Não consegui copiar. Selecione o texto e copie."); }
  };
  const usarGancho = async () => {
    try {
      await createPost.mutateAsync({ title: gancho.replace(/[[\]]/g, "").slice(0, 80), hook: gancho, status: "ideia", platform: "instagram", format: "reels" });
      toast.success("Rascunho criado no Criando com esse gancho.", { action: { label: "Abrir", onClick: () => navigate("/app/criando") } });
    } catch { toast.error("Não consegui criar o rascunho."); }
  };

  const reaproveitarPost = () => {
    const id = insta.mais?.postId;
    const p = id ? posts.find((x) => x.id === id) : null;
    if (p) setReaproveitar(p);
  };

  if (profileLoading) return <div className="pb-20 md:pb-0"><PageSkeleton /></div>;

  const atalhos = (
    <>
      <AtalhoInicio cor="#FFCF03" titulo="Nova ideia" curto="Ideia" onClick={() => setCaptura(true)} icone={<Lightbulb className="h-4 w-4 shrink-0" />} />
      <AtalhoInicio cor="#FF77B9" titulo="Gravar no Prompter" curto="Prompter" sub={isStudio ? (praGravar ? `${praGravar} pra gravar` : "teleprompter") : "no Studio"} onClick={gravar} icone={<Video className="h-4 w-4 shrink-0" />} />
      <AtalhoInicio cor="#DCE6FF" titulo="Pedir pra Cria IA" curto="Cria IA" onClick={() => openCria()} icone={<Sparkles className="h-4 w-4 shrink-0" />} />
    </>
  );

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={cn("flex flex-col", GAP)}>

        <FirstStepsPanel />

        {/* TOPO */}
        <section className={cn(CARTAO_INICIO, "p-5 gap-4")} data-tour="dash-acao">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-body italic text-muted-foreground first-letter:uppercase">{dataExtenso}</p>
              <h2 className="font-display font-extrabold text-[24px] sm:text-[28px] leading-tight text-foreground [text-wrap:balance]">
                {saiHoje === 0 ? "Nada marcado pra sair hoje." : saiHoje === 1 ? "Hoje sai 1 post." : `Hoje saem ${saiHoje} posts.`}
              </h2>
            </div>
            <div className="grid grid-cols-3 lg:flex gap-2 lg:gap-2.5" data-tour="dash-atalhos">{atalhos}</div>
          </div>
          <FaixaTrava contagem={travas} onAbrir={abrirTrava} />
        </section>

        {/* SEMANA | HOJE */}
        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GAP)}>
          <CardInicio className="lg:col-span-8 order-2 lg:order-1" data-tour="dash-posts"
            titulo="Sai esta semana" direita={<span className="hidden sm:inline">linha editorial e posts</span>}>
            <SemanaDoCriador posts={semana} comMidia={comMidia} thumbs={thumbs} hoje={hoje}
              linha={activeProfile?.editorial_line} pilares={pillars}
              onAbrirPost={() => navigate("/app/criando")}
              onNovo={() => setCaptura(true)} />
          </CardInicio>
          <CardInicio className="lg:col-span-4 order-1 lg:order-2" data-tour="dash-hoje" faixa="#EB4918"
            titulo={`Hoje · ${feitas} de ${tarefasHoje.length} ${tarefasHoje.length === 1 ? "feita" : "feitas"}`}
            direita={<button type="button" onClick={() => navigate("/app/tarefas")} className="font-semibold underline">Tarefas</button>}
            corpo="bg-[#FFFCF3] dark:bg-card">
            <HojeDoCriador tarefas={tarefasHoje} hoje={hoje}
              onAlternar={(id) => { const t = tarefasHoje.find((x) => x.id === id); if (t) alternar.mutate(t, { onError: () => toast.error("Não consegui marcar a tarefa.") }); }}
              onCriar={async (titulo) => { await createTask.mutateAsync({ title: titulo, due_date: hoje, priority: "media", status: "pendente" }); }}
              habitos={habitos}
              onHabito={(id) => toggleHabitLog.mutate({ habitId: id, date: hoje }, { onError: () => toast.error("Erro ao marcar o hábito.") })}
              onVerTodas={() => navigate("/app/tarefas")} />
          </CardInicio>
        </div>

        {/* INSTAGRAM | GANCHO E CRIA IA */}
        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GAP)}>
          <CardInicio className="lg:col-span-8" data-tour="dash-instagram" titulo="Seu Instagram"
            direita={<button type="button" onClick={() => navigate("/app/insights")}
              /* Atalho pros Insights (Walter, 06/11/2026: acesso rápido direto do Início). */
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-foreground bg-[#F6D9E8] dark:bg-pink-500/20 px-3 h-8 font-body font-bold text-[12px] text-foreground shadow-[0_2px_0_hsl(var(--foreground))] hover:-translate-y-0.5 transition-transform">
              <BarChart3 className="h-3.5 w-3.5" /> Abrir Insights <ArrowRight className="h-3.5 w-3.5" /></button>}>
            {insta.isLoading ? null : !insta.conn ? (
              <div className="flex h-full flex-col sm:flex-row sm:items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4]"><Instagram className="h-6 w-6 text-white" /></span>
                <p className="flex-1 text-[13.5px] font-body text-muted-foreground">
                  {insta.isOwnAccount ? "Conecte seu Instagram pra ver aqui seus números comparados com os 30 dias anteriores e o post que mais funcionou."
                    : "Instagram ainda não conectado. Peça pro dono da conta conectar em Insights."}
                </p>
                {insta.isOwnAccount && (
                  <button type="button" onClick={() => connectInstagram(null, null, insta.contaParaConectar)}
                    className="shrink-0 rounded-full border-2 border-foreground bg-foreground text-background px-4 h-10 text-[13px] font-body font-bold">Conectar Instagram</button>
                )}
              </div>
            ) : (
              <div className="flex h-full flex-col gap-3">
                <p className="text-[11.5px] font-body text-muted-foreground -mt-1">Últimos 30 dias, comparados com os 30 anteriores.</p>
                {/* Os números também abrem os Insights. */}
                <button type="button" onClick={() => navigate("/app/insights")} aria-label="Abrir Insights" className="block w-full text-left rounded-xl transition-opacity hover:opacity-80">
                  <NumerosInstagram r={insta} />
                </button>
                {insta.mais && (
                  <div className="mt-auto flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl bg-[#D8F2E0] dark:bg-emerald-500/10 p-3 min-w-0">
                    <span className="h-[60px] w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {insta.mais.thumb && <img src={insta.mais.thumb} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-body font-bold uppercase tracking-wide text-foreground/70">O que mais funcionou</p>
                      <p className="text-[13px] font-body font-bold leading-snug line-clamp-1">{insta.mais.titulo}</p>
                      <p className="text-[12px] font-body text-foreground/75 leading-snug line-clamp-2">{insta.mais.frase}</p>
                    </div>
                    {insta.mais.postId && posts.some((x) => x.id === insta.mais!.postId) ? (
                      <button type="button" onClick={reaproveitarPost}
                        className="shrink-0 w-full sm:w-auto justify-center inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-card px-3 h-9 text-[12px] font-body font-bold"><Repeat2 className="h-3.5 w-3.5" /> Reaproveitar</button>
                    ) : insta.mais.permalink ? (
                      <a href={insta.mais.permalink} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 w-full sm:w-auto justify-center inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-card px-3 h-9 text-[12px] font-body font-bold"><ExternalLink className="h-3.5 w-3.5" /> Ver</a>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </CardInicio>

          <div className={cn("lg:col-span-4 flex flex-col", GAP)}>
            <CardInicio className="flex-1" titulo="Gancho do dia" corpo="bg-[#FFF6BF] dark:bg-amber-500/10" data-tour="dash-gancho">
              <div className="flex h-full flex-col gap-3">
                <p className="text-[14px] font-body italic leading-relaxed text-foreground">"{gancho}"</p>
                <div className="mt-auto flex gap-2">
                  <button type="button" onClick={() => void copiarGancho()} className="inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-card px-3 h-8 text-[12px] font-body font-bold">
                    {copiado ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
                  </button>
                  <button type="button" onClick={() => void usarGancho()} disabled={createPost.isPending}
                    className="inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-card px-3 h-8 text-[12px] font-body font-bold disabled:opacity-60">Usar no post</button>
                </div>
              </div>
            </CardInicio>
            {!ia.isLoading && ia.quota > 0 && (
              <CardInicio className="h-auto" titulo="Cria IA este mês" direita={<span className="tabular-nums">{ia.used} de {ia.quota}</span>}>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", ia.pct >= 90 ? "bg-red-500" : ia.pct >= 80 ? "bg-amber-500" : "bg-[#00A652]")} style={{ width: `${Math.min(100, ia.pct)}%` }} />
                </div>
                <p className="mt-2 text-[11.5px] font-body text-muted-foreground">
                  {ia.remaining === 0 ? "As gerações deste mês acabaram." : `${ia.remaining} ${ia.remaining === 1 ? "geração sobrando" : "gerações sobrando"}.`}
                </p>
              </CardInicio>
            )}
          </div>
        </div>

        <div data-tour="dash-quem"><WhoYouAre largo /></div>
        {temCriakut && activeProfile?.id === user?.id && (
          <div data-tour="dash-criakut"><ConviteCriakut variante="criador" nicho={activeProfile?.niche ?? null} temTom={temTom}
            nomeFallback={activeProfile?.name ?? null} fotoFallback={activeProfile?.avatar_url ?? null} /></div>
        )}
      </motion.div>

      <CapturaRapidaDialog open={captura} onOpenChange={setCaptura} />
      <VitrineStudio open={vitrine} onOpenChange={setVitrine} />
      {reaproveitar && <RepurposeSheet open={!!reaproveitar} onOpenChange={(o) => { if (!o) setReaproveitar(null); }} originalPost={reaproveitar} />}
    </div>
  );
};

export default Dashboard;

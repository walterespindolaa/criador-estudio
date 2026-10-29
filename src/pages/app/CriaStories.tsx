import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clapperboard, Loader2, Plus, X, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useStoryTrends, storyTrendsToContext } from "@/hooks/useStoryTrends";
import {
  useStorySlots, useScheduledPostsInRange, useUpdateStorySlot, useDeleteStorySlot, useAddStorySlot,
  useStoryPosts, useMarcarStoryPostado, useGerarStoriesPrevia, useSalvarStoriesPrevia,
  type StorySlot, type StoryPrevia, type ScheduledPostLite,
} from "@/hooks/useStoryPlan";
import { estadoDoStory, type AcaoStory } from "@/components/stories/StoryAndamento";
import { NovoStoryDialog, type NovoStoryEstado, type StorySalvo } from "@/components/stories/NovoStoryDialog";
import { TrendPickerDialog, Chip } from "@/components/tendencias/TrendPickerDialog";
import { useTendencias, tendenciasParaIA, registrarUsoTendencias, type Tendencia } from "@/hooks/useTendencias";
import { useSendPostToPrompter } from "@/hooks/usePrompterScripts";
import { ConferenciaPublicacao } from "@/components/shared/ConferenciaPublicacao";
import { CrIA } from "@/components/brand/CrIA";
import { falaDoStory, NOME_TIPO, tipoDoFormato, type TipoStory } from "@/lib/storyRoteiro";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA STORIES (28/10/2026, mockup aprovado, aba 2)

   v3 (28/10, mockup aprovado): semana vazia vira um bloco só com a ação
   principal; contadores viram linha de texto; colunas do tamanho do conteúdo
   com "+" no topo; posts do feed viram "N no feed"; no celular, seletor de
   dias + lista do dia.
   A semana é a tela: resumo em cima (pra gravar, pelo celular, faltam mídia,
   já saíram), faixa curta do que o Instagram não publica, 7 colunas com o
   próximo passo de cada story e "Montar a semana com a CrIA" num painel com
   prévia antes de entrar no plano. As antigas abas Criar/Semana viraram uma.
   ═══════════════════════════════════════════════════════════════════════════ */

function localIso(d = new Date()): string {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
}
function isoAddDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return localIso(d);
}
/** A semana do Cria Stories começa na segunda (igual ao mockup). */
function segundaDe(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const DIA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const diaRotulo = (iso: string) => { const d = new Date(iso + "T00:00:00"); return `${DIA_CURTO[d.getDay()]} ${d.getDate()}`; };
const dm = (iso: string) => { const [, m, d] = iso.split("-"); return `${Number(d)}/${Number(m)}`; };

const AVISO_KEY = "cria_stories_aviso_ok_v1";
const OBJETIVOS = ["Aproximar", "Vender", "Mostrar bastidor", "Levar pro post do feed"];

type Resumo = { total: number; gravar: number; celular: number; midia: number; saiu: number };

export default function CriaStories() {
  const { profile: contaAtiva } = useActiveProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  /* Vindo da página Tendências ("Montar stories com elas"): abre o painel com
     as marcadas como base. */
  const chavesVindas = (location.state as { tendencias?: string[] } | null)?.tendencias ?? [];
  const hoje = localIso();

  const [semana, setSemana] = useState<Date>(() => segundaDe(new Date()));
  const de = localIso(semana);
  const ate = isoAddDays(de, 6);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => isoAddDays(de, i)), [de]);

  const { data: slots = [], isLoading } = useStorySlots(de, ate);
  const { data: postsFeed = [] } = useScheduledPostsInRange(de, ate);
  const postIds = useMemo(() => slots.map((s) => s.post_id).filter(Boolean) as string[], [slots]);
  const { data: storyPosts = {} } = useStoryPosts(postIds);
  const { data: podePublicar = {} } = useQuery<Record<string, boolean>>({
    queryKey: ["story-pode-publicar", [...postIds].sort().join(",")],
    enabled: postIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown }>;
      const { data } = await rpc("ig_status_publicacoes", { _post_ids: postIds });
      const m: Record<string, boolean> = {};
      for (const r of (data as Array<{ post_id: string; pode_publicar: boolean }> | null) ?? []) m[r.post_id] = r.pode_publicar;
      return m;
    },
  });

  const sendPrompter = useSendPostToPrompter();
  const marcarPostado = useMarcarStoryPostado();
  const upd = useUpdateStorySlot();
  const del = useDeleteStorySlot();
  const add = useAddStorySlot();
  const desfazerConf = useMutation({
    mutationFn: async (postId: string) => {
      const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      const { error } = await rpc("ig_desfazer_conferencia", { _post_id: postId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["story-posts"] }); toast.success("Conferência desfeita."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [conf, setConf] = useState<{ postId: string; agora: boolean } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  /* Atalho "Gravar story" da página inicial: abre o Novo story de hoje, falado. */
  const [editor, setEditor] = useState<NovoStoryEstado>(() =>
    (location.state as { novoStory?: boolean } | null)?.novoStory ? { mode: "create", date: localIso(), tipo: "falado" } : { mode: "closed" });
  const [salvando, setSalvando] = useState(false);
  const [painel, setPainel] = useState(chavesVindas.length > 0);
  const [avisoOk, setAvisoOk] = useState(() => { try { return localStorage.getItem(AVISO_KEY) === "1"; } catch { return false; } });
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [diaSel, setDiaSel] = useState<string>(hoje);

  const estados = useMemo(() => {
    const m: Record<string, ReturnType<typeof estadoDoStory>> = {};
    for (const s of slots) m[s.id] = estadoDoStory(s, s.post_id ? storyPosts[s.post_id] : undefined, s.post_id ? podePublicar[s.post_id] : undefined);
    return m;
  }, [slots, storyPosts, podePublicar]);

  const resumo = useMemo<Resumo>(() => {
    const r: Resumo = { total: slots.length, gravar: 0, celular: 0, midia: 0, saiu: 0 };
    for (const s of slots) {
      const e = estados[s.id];
      if (!e) continue;
      if (e.selo === "Saiu") r.saiu++;
      else if (e.selo === "Pra gravar") r.gravar++;
      else if (e.selo === "Pelo celular") r.celular++;
      else if (e.selo === "Falta a mídia") r.midia++;
    }
    return r;
  }, [slots, estados]);

  /* Abre o Prompter no modo story com a FALA do roteiro (a etiqueta "Mostrar"
     e o "Na tela" o player lê do post). */
  const gravar = (postId: string, title: string, script: string | null | undefined, slotId: string) => {
    const fala = falaDoStory(script).fala.trim();
    if (!fala) { toast.error("Esse story ainda não tem fala. Abra ele e escreva o que falar."); return; }
    setOcupado(slotId);
    sendPrompter.mutate({ postId, title, script: fala, source: "stories" }, {
      onSuccess: (id) => navigate(`/app/prompter/gravar/${id}`),
      onSettled: () => setOcupado(null),
    });
  };

  const agir = (slot: StorySlot, a: AcaoStory) => {
    const postId = slot.post_id;
    if (!postId) { setEditor({ mode: "edit", slot }); return; }
    const post = storyPosts[postId];
    if (a === "midia") { navigate(`/app/criando?post=${postId}`); return; }
    if (a === "conferir") { setConf({ postId, agora: false }); return; }
    if (a === "tentar") { setConf({ postId, agora: true }); return; }
    if (a === "postei") { marcarPostado.mutate(postId); return; }
    if (a === "desfazer") { desfazerConf.mutate(postId); return; }
    if (a === "gravar") gravar(postId, slot.title, post?.script ?? slot.script, slot.id);
  };

  /* Salvar do Novo story: "salvar" só guarda; "principal" faz o caminho do tipo. */
  const salvarStory = async (d: StorySalvo, acao: "salvar" | "principal", tipo: TipoStory, slotId?: string) => {
    setSalvando(true);
    try {
      let postId: string | null = null;
      let idSlot = slotId ?? "";
      if (slotId) {
        await upd.mutateAsync({ id: slotId, patch: {
          title: d.title, script: d.script, format: d.format, slot_time: d.slot_time, slot_date: d.slot_date,
          notify_title: d.notify_title, notify_body: d.notify_body,
        } });
        postId = slots.find((s) => s.id === slotId)?.post_id ?? null;
        if (d.weekdays?.length) await add.mutateAsync({ ...d, source: "manual-recorrente" });
      } else {
        const r = await add.mutateAsync(d);
        postId = r.primeiro?.post_id ?? null;
        idSlot = r.primeiro?.id ?? "";
      }
      setEditor({ mode: "closed" });
      if (acao === "salvar") return;
      if (!postId) { toast.message("Story salvo. Abra ele de novo em instantes pra seguir."); return; }
      if (tipo === "falado") gravar(postId, d.title, d.script, idSlot);
      else {
        if (tipo === "figurinha") toast.message("A figurinha você coloca no app do Instagram na hora de postar. Aqui fica a mídia de fundo.");
        navigate(`/app/criando?post=${postId}`);
      }
    } catch {
      /* o toast de erro vem do hook */
    } finally {
      setSalvando(false);
    }
  };

  const reagendar = (id: string, iso: string) => upd.mutate({ id, patch: { slot_date: iso } });

  const vazia = !isLoading && slots.length === 0;
  const diaMobile = dias.includes(diaSel) ? diaSel : (dias.includes(hoje) ? hoje : dias[0]);
  const nomeCompleto = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric" });
  const abrirMontar = () => setPainel(true);
  const novoStory = (iso: string) => setEditor({ mode: "create", date: iso });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-28 md:pb-0 flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3" data-tour="stories-abas">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-pink-400 flex items-center justify-center shadow-sm shrink-0">
            <Clapperboard className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Cria Stories</h1>
            <p className="text-muted-foreground font-body text-sm mt-0.5">Semana de {dm(de)} a {dm(ate)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" className="rounded-full w-9 px-0" aria-label="Semana anterior" onClick={() => setSemana((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; })}>←</Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setSemana(segundaDe(new Date())); setDiaSel(hoje); }}>Hoje</Button>
          <Button variant="outline" size="sm" className="rounded-full w-9 px-0" aria-label="Próxima semana" onClick={() => setSemana((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; })}>→</Button>
          {!vazia && (
            <Button size="sm" className="rounded-full hidden md:inline-flex" data-tour="stories-config" onClick={() => setPainel((v) => !v)}>
              <span aria-hidden>✦</span> Refazer com a <CrIA sobreLaranja />
            </Button>
          )}
        </div>
      </div>

      {!vazia && slots.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-body text-muted-foreground">
          <span><b className="text-foreground text-[15px] tabular-nums">{resumo.total}</b> stories</span>
          {resumo.gravar > 0 && <span><b className="text-emerald-700 dark:text-emerald-400 text-[15px] tabular-nums">{resumo.gravar}</b> pra gravar</span>}
          {resumo.celular > 0 && <span><b className="text-amber-700 dark:text-amber-400 text-[15px] tabular-nums">{resumo.celular}</b> pelo celular</span>}
          {resumo.midia > 0 && <span><b className="text-foreground text-[15px] tabular-nums">{resumo.midia}</b> {resumo.midia === 1 ? "falta mídia" : "faltam mídia"}</span>}
          {resumo.saiu > 0 && <span><b className="text-emerald-700 dark:text-emerald-400 text-[15px] tabular-nums">{resumo.saiu}</b> já {resumo.saiu === 1 ? "saiu" : "saíram"}</span>}
        </div>
      )}

      {!avisoOk && resumo.celular > 0 && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 px-3.5 py-3 flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-body font-bold rounded-full px-2.5 py-0.5 bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100">Pelo celular</span>
          <span className="text-[12.8px] font-body text-foreground flex-1 min-w-[200px]">Figurinha e música o Instagram não deixa publicar por sistema. Esses stories ficam com lembrete: baixe a mídia aqui e poste pelo app.</span>
          <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => { setAvisoOk(true); try { localStorage.setItem(AVISO_KEY, "1"); } catch { /* ok */ } }}>Entendi</Button>
        </div>
      )}

      {painel && <MontarSemana dias={dias} hoje={hoje} nicho={contaAtiva?.niche ?? undefined} chavesIniciais={chavesVindas} onFechar={() => setPainel(false)} />}

      {/* Seletor de dias: só no celular */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
        {dias.map((iso) => {
          const n = slots.filter((s) => s.slot_date === iso).length;
          const on = iso === diaMobile;
          const d = new Date(iso + "T00:00:00");
          return (
            <button key={iso} type="button" onClick={() => setDiaSel(iso)}
              className={cn("shrink-0 w-[46px] rounded-[14px] border py-1.5 text-center font-body text-[11px]",
                on ? "bg-foreground border-foreground text-background" : "bg-card border-border text-muted-foreground",
                !on && iso === hoje && "border-primary")}>
              {DIA_CURTO[d.getDay()]}
              <b className={cn("block font-display text-base leading-tight", on ? "text-background" : "text-foreground")}>{d.getDate()}</b>
              <span className="flex justify-center gap-0.5 h-1.5 mt-0.5">
                {Array.from({ length: Math.min(n, 4) }, (_, i) => <i key={i} className={cn("h-[5px] w-[5px] rounded-full", on ? "bg-background" : "bg-primary")} />)}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="h-6 w-6 text-primary mx-auto animate-spin" /></div>
      ) : vazia ? (
        !painel && (
          <div className="rounded-[22px] bg-card border border-border px-4 py-8 md:py-10 text-center">
            <h2 className="font-display font-extrabold text-[19px] md:text-[22px] text-foreground">{dias.includes(hoje) ? "Sua semana de stories está vazia" : "Essa semana ainda está vazia"}</h2>
            <p className="text-sm font-body text-muted-foreground max-w-[460px] mx-auto mt-1.5 mb-5">
              A <b className="text-foreground">Cria IA</b> monta os dias com o que está em alta no seu nicho. Você só revisa e grava.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button size="lg" className="rounded-full" data-tour="stories-config" onClick={abrirMontar}>
                <span aria-hidden>✦</span> Montar a semana com a <CrIA sobreLaranja />
              </Button>
              <Button size="lg" variant="outline" className="rounded-full" onClick={() => novoStory(dias.includes(hoje) ? hoje : dias[0])}>
                <Plus className="h-4 w-4" /> Escrever um story
              </Button>
            </div>
            <div className="hidden md:flex flex-wrap justify-center gap-2.5 mt-6">
              {[["1. A Cria IA sugere", "gancho, interação e horário de cada dia"], ["2. Você ajusta", "troca, arrasta ou apaga o que não fizer sentido"], ["3. Grava no Prompter", "a fala rola na tela no seu ritmo"]].map(([t, d]) => (
                <div key={t} className="w-[200px] rounded-2xl bg-muted/60 px-3 py-2.5 text-left text-[12.5px] font-body text-muted-foreground">
                  <b className="block text-[13px] text-foreground">{t}</b>{d}
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          {/* Computador: a semana em 7 colunas, do tamanho do conteúdo */}
          <div className="hidden md:grid grid-cols-7 gap-2 items-start" data-tour="stories-tendencias">
            {dias.map((iso) => {
              const doDia = slots.filter((s) => s.slot_date === iso);
              const feed = postsFeed.filter((p) => p.scheduled_date === iso);
              const ehHoje = iso === hoje;
              return (
                <div key={iso}
                  onDragOver={(e) => { e.preventDefault(); setSobre(iso); }}
                  onDragLeave={() => setSobre((k) => (k === iso ? null : k))}
                  onDrop={() => { if (arrastando) reagendar(arrastando, iso); setArrastando(null); setSobre(null); }}
                  className={cn("min-w-0 rounded-2xl bg-card border border-border p-2 flex flex-col gap-1.5 transition-shadow",
                    ehHoje && "border-2 border-primary", sobre === iso && "ring-2 ring-primary/60")}>
                  <div className="flex items-center justify-between gap-1 text-[12.5px] font-body font-extrabold">
                    <span className="truncate">{diaRotulo(iso)}{ehHoje ? " · hoje" : ""}</span>
                    <button type="button" aria-label={`Novo story em ${diaRotulo(iso)}`} onClick={() => novoStory(iso)}
                      className="shrink-0 h-6 w-6 rounded-lg border border-dashed border-border grid place-items-center text-muted-foreground hover:text-primary hover:border-primary/50">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {feed.length > 0 && (
                    <span className="text-[11px] font-body text-muted-foreground inline-flex items-center gap-1 cursor-default"
                      title={feed.map((p: ScheduledPostLite) => p.title || "sem título").join(" · ")}>
                      <i className="h-1.5 w-1.5 rounded-sm bg-muted-foreground/50" />{feed.length} no feed
                    </span>
                  )}
                  {doDia.map((s) => (
                    <CardStory key={s.id} slot={s} estado={estados[s.id]} ocupado={ocupado === s.id}
                      onAbrir={() => setEditor({ mode: "edit", slot: s })}
                      onAcao={(a) => agir(s, a)}
                      onArrastar={() => setArrastando(s.id)} onSoltar={() => { setArrastando(null); setSobre(null); }} />
                  ))}
                  {doDia.length === 0 && <span className="text-[11.5px] font-body text-muted-foreground text-center py-2.5 rounded-xl border border-dashed border-border">livre</span>}
                </div>
              );
            })}
          </div>

          {/* Celular: a lista do dia escolhido */}
          <div className="md:hidden flex flex-col gap-2">
            <p className="text-[11px] font-body font-extrabold uppercase tracking-wider text-muted-foreground first-letter:uppercase">
              {nomeCompleto(diaMobile)}{diaMobile === hoje ? ", hoje" : ""}
            </p>
            {slots.filter((s) => s.slot_date === diaMobile).map((s) => (
              <CardStory key={s.id} grande slot={s} estado={estados[s.id]} ocupado={ocupado === s.id}
                onAbrir={() => setEditor({ mode: "edit", slot: s })}
                onAcao={(a) => agir(s, a)} onArrastar={() => {}} onSoltar={() => {}} />
            ))}
            {slots.filter((s) => s.slot_date === diaMobile).length === 0 && (
              <button type="button" onClick={() => novoStory(diaMobile)}
                className="rounded-2xl border-[1.5px] border-dashed border-border py-6 text-sm font-body font-bold text-muted-foreground inline-flex items-center justify-center gap-1">
                <Plus className="h-4 w-4" /> Nada nesse dia. Escrever um story
              </button>
            )}
          </div>
        </>
      )}

      {/* Posts do feed: no celular, os do dia escolhido; no computador, só com a semana vazia */}
      {(() => {
        const feedDia = postsFeed.filter((p) => p.scheduled_date === diaMobile);
        return feedDia.length > 0 && (
          <div className="md:hidden">
            <p className="text-[11px] font-body font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">No feed nesse dia</p>
            <div className="rounded-xl border border-dashed border-border px-3 py-2 text-[12.5px] font-body text-muted-foreground flex flex-col gap-0.5">
              {feedDia.map((p) => <span key={p.id}>{p.title || "sem título"}{p.scheduled_time ? ` · ${p.scheduled_time.slice(0, 5)}` : ""}</span>)}
            </div>
          </div>
        );
      })()}
      {vazia && postsFeed.length > 0 && (
        <div className="hidden md:flex flex-wrap items-center gap-2 text-[12.5px] font-body text-muted-foreground">
          <span>No feed esta semana:</span>
          {postsFeed.map((p) => (
            <span key={p.id} className="rounded-full bg-card border border-border px-2.5 py-1 text-foreground">{diaRotulo(p.scheduled_date).split(" ")[0]} · {p.title || "sem título"}</span>
          ))}
        </div>
      )}

      {/* Celular: ações fixas no rodapé */}
      {!vazia && !isLoading && (
        <div className="md:hidden fixed left-3 right-3 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-20 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-full h-11 bg-card shadow-lg" onClick={() => novoStory(diaMobile)}><Plus className="h-4 w-4" /> Novo story</Button>
          <Button className="flex-1 rounded-full h-11 shadow-lg" onClick={() => setPainel((v) => !v)}><span aria-hidden>✦</span> Refazer com a <CrIA sobreLaranja /></Button>
        </div>
      )}

      <NovoStoryDialog state={editor} onClose={() => setEditor({ mode: "closed" })} onSalvar={salvarStory} ocupado={salvando}
        onExcluir={editor.mode === "edit" ? () => { del.mutate(editor.slot.id); setEditor({ mode: "closed" }); } : undefined} />
      {conf && (
        <ConferenciaPublicacao postId={conf.postId} open onOpenChange={(v) => { if (!v) setConf(null); }} agora={conf.agora}
          onConcluido={() => qc.invalidateQueries({ queryKey: ["story-posts"] })} />
      )}
    </motion.div>
  );
}

const SELO_COR: Record<string, string> = {
  "Saiu": "bg-emerald-700 text-white",
  "Pra gravar": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  "Pelo celular": "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "Falta a mídia": "bg-muted text-muted-foreground",
};

function CardStory({ slot, estado, ocupado, onAbrir, onAcao, onArrastar, onSoltar, grande }: {
  grande?: boolean; slot: StorySlot; estado: ReturnType<typeof estadoDoStory>; ocupado: boolean;
  onAbrir: () => void; onAcao: (a: AcaoStory) => void; onArrastar: () => void; onSoltar: () => void;
}) {
  const hora = slot.slot_time ? slot.slot_time.slice(0, 5) : "";
  const tipo = tipoDoFormato(slot.format);
  const selo = estado?.selo ?? NOME_TIPO[tipo];
  const seloCls = (estado && SELO_COR[estado.selo]) ?? (estado ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" : "bg-muted text-muted-foreground");
  return (
    <div draggable={!grande} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onArrastar(); }} onDragEnd={onSoltar}
      className={cn("flex flex-col gap-1.5 text-xs",
        grande ? "rounded-2xl bg-card border border-border p-3.5" : "rounded-xl bg-muted/60 p-2 cursor-grab active:cursor-grabbing")}>
      <div className="flex items-center justify-between gap-1.5">
        <span className={cn("text-[10.5px] font-body font-bold rounded-full px-2 py-0.5 truncate", seloCls)}>{selo}</span>
        {hora && <span className="text-[11px] font-body text-muted-foreground tabular-nums">{hora}</span>}
      </div>
      <button type="button" onClick={onAbrir} className={cn("text-left font-body font-bold leading-snug text-foreground hover:underline line-clamp-3", grande ? "text-[15px]" : "text-[12.5px]")}>{slot.title}</button>
      {grande && falaDoStory(slot.script).fala.trim() && <span className="text-[12.5px] font-body text-muted-foreground line-clamp-2">"{falaDoStory(slot.script).fala.trim()}"</span>}
      {estado?.numeros && estado.numeros.length > 0 && (
        <span className="text-[11px] font-body text-muted-foreground">{estado.numeros.map((n) => `${n.v.toLocaleString("pt-BR")} ${n.r}`).join(" · ")}</span>
      )}
      {estado?.nota && estado.selo !== "Pelo celular" && <span className="text-[10.5px] font-body text-muted-foreground leading-snug line-clamp-2">{estado.nota}</span>}
      {(estado?.acao || estado?.acao2) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {estado.acao && (
            <button type="button" disabled={ocupado} onClick={() => onAcao(estado.acao!.tipo)}
              className={cn("rounded-full font-body font-bold disabled:opacity-60 inline-flex items-center gap-1", grande ? "h-9 px-3.5 text-[12.5px]" : "h-7 px-2.5 text-[11px]",
                estado.acao.tipo === "gravar" ? "bg-primary text-primary-foreground" : "border border-border bg-background")}>
              {ocupado && <Loader2 className="h-3 w-3 animate-spin" />}{estado.acao.txt}
            </button>
          )}
          {estado.acao2 && (
            <button type="button" disabled={ocupado} onClick={() => onAcao(estado.acao2!.tipo)}
              className="text-[11px] font-body font-semibold text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
              {estado.acao2.txt}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Montar a semana com a Cria IA ─────────────────────────────────────────── */
function MontarSemana({ dias, hoje, nicho, chavesIniciais = [], onFechar }: { dias: string[]; hoje: string; nicho?: string; chavesIniciais?: string[]; onFechar: () => void }) {
  const { data: storyTrends = [] } = useStoryTrends();
  const { data: todasTend } = useTendencias();
  const futuros = dias.filter((d) => d >= hoje);
  const [escolhidos, setEscolhidos] = useState<string[]>(() => (futuros.length ? futuros : dias).slice(0, 5));
  const [porDia, setPorDia] = useState(3);
  const [objetivo, setObjetivo] = useState(OBJETIVOS[0]);
  const [tendencias, setTendencias] = useState<Tendencia[]>([]);
  const [semeado, setSemeado] = useState(false);
  if (!semeado && chavesIniciais.length && todasTend.length) {
    setSemeado(true);
    setTendencias(todasTend.filter((t) => chavesIniciais.includes(t.chave)).slice(0, 3));
  }
  const [picker, setPicker] = useState(false);
  const [previa, setPrevia] = useState<StoryPrevia[] | null>(null);
  const gerar = useGerarStoriesPrevia();
  const salvar = useSalvarStoriesPrevia();

  const datas = dias.filter((d) => escolhidos.includes(d));
  const total = datas.length * porDia;

  const rodar = () => {
    if (!datas.length) { toast.error("Escolha ao menos um dia."); return; }
    gerar.mutate({
      datas, perDia: porDia, nicho, objetivo,
      escolhidas: tendencias.length ? tendenciasParaIA(tendencias) : undefined,
      tendencias: storyTrends.length ? storyTrendsToContext(storyTrends) : undefined,
    }, { onSuccess: (l) => { setPrevia(l); if (tendencias.length) registrarUsoTendencias(tendencias, "montar-semana-stories"); } });
  };

  return (
    <section className="rounded-[22px] bg-card border border-border p-5 grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display font-extrabold text-lg">Montar a semana com a <CrIA /></h2>
            <p className="text-[13px] font-body text-muted-foreground">Ela escreve os stories e encaixa nos dias. Você revisa antes de entrar no plano.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <Campo rotulo="Dias">
          <div className="flex flex-wrap gap-1.5">
            {dias.map((d) => (
              <Chip key={d} on={escolhidos.includes(d)} className={d < hoje ? "opacity-40 pointer-events-none" : ""}
                onClick={() => setEscolhidos((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]))}>{diaRotulo(d)}</Chip>
            ))}
          </div>
        </Campo>
        <Campo rotulo="Stories por dia">
          <div className="flex rounded-xl border-[1.5px] border-border overflow-hidden max-w-[260px]">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" onClick={() => setPorDia(n)} aria-pressed={porDia === n}
                className={cn("flex-1 py-2 text-[13px] font-body font-bold", porDia === n ? "bg-foreground text-background" : "bg-card")}>{n}</button>
            ))}
          </div>
        </Campo>
        <Campo rotulo="Objetivo da semana">
          <div className="flex flex-wrap gap-1.5">
            {OBJETIVOS.map((o) => <Chip key={o} on={objetivo === o} onClick={() => setObjetivo(o)}>{o}</Chip>)}
          </div>
        </Campo>
        <Campo rotulo="Tendências como base">
          <div className="flex flex-wrap items-center gap-1.5">
            {tendencias.map((t) => (
              <span key={t.chave} className="text-[11.5px] font-body font-bold rounded-full px-2.5 py-1 bg-primary/10 text-primary inline-flex items-center gap-1">
                {t.titulo}
                <button type="button" aria-label={`Tirar ${t.titulo}`} onClick={() => setTendencias((l) => l.filter((x) => x.chave !== t.chave))}><X className="h-3 w-3" /></button>
              </span>
            ))}
            <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => setPicker(true)}>+ Escolher</Button>
          </div>
        </Campo>
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-full" onClick={rodar} disabled={gerar.isPending || total === 0}>
            {gerar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <span aria-hidden>✦</span>}
            {gerar.isPending ? "Escrevendo…" : `Gerar ${total} stories`}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={onFechar}>Cancelar</Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">Como vai ficar</p>
        {!previa ? (
          <>
            {[["Ter · 9h · Falado", "Bom dia com a meta da semana"], ["Ter · 13h · Figurinha", "Enquete: grava tudo num dia?"], ["Ter · 19h · Foto", "Set montado pro dia de gravação"]].map(([a, b]) => (
              <div key={a} className="rounded-xl bg-muted/60 px-3 py-2.5 flex justify-between gap-2 text-[12.5px] font-body opacity-60"><span>{a}</span><b className="text-right">{b}</b></div>
            ))}
            <p className="text-[13px] font-body text-muted-foreground mt-1">Mistura tipos pra não ficar tudo falado. Os falados já entram no Prompter em “Pra gravar”.</p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5 max-h-[340px] overflow-y-auto pr-1">
              {previa.map((p, i) => (
                <div key={i} className="rounded-xl bg-muted/60 px-3 py-2.5 flex justify-between gap-2 text-[12.5px] font-body">
                  <span className="text-muted-foreground shrink-0">{diaRotulo(p.date).split(" ")[0]} · {p.slot_time ?? "--"} · {NOME_TIPO[p.tipo]}</span>
                  <b className="text-right">{p.title}</b>
                  <button type="button" aria-label="Tirar da prévia" className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setPrevia((l) => (l ? l.filter((_, j) => j !== i) : l))}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              <Button className="rounded-full" disabled={!previa.length || salvar.isPending}
                onClick={() => salvar.mutate(previa, { onSuccess: () => { setPrevia(null); onFechar(); } })}>
                {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Colocar na semana ({previa.length})
              </Button>
              <Button variant="outline" className="rounded-full" onClick={rodar} disabled={gerar.isPending}>Gerar de novo</Button>
            </div>
          </>
        )}
      </div>

      <TrendPickerDialog open={picker} onOpenChange={setPicker} titulo="Tendências pra stories" botao="Usar na semana"
        subtitulo="Marque até 3. A semana inteira usa elas como base." preferir="story"
        iniciais={tendencias.map((t) => t.chave)} onConfirmar={setTendencias} />
    </section>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{rotulo}</p>
      {children}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { usePosts } from "@/hooks/usePosts";
import { useGoals } from "@/hooks/useGoals";
import { useReflections } from "@/hooks/useReflections";
import { toast } from "sonner";
import { useDailyMetrics } from "@/hooks/useSocialInsights";
import { hojeBR } from "@/lib/date-br";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/shared/Confirm";
import {
  AvisoDuplicadas, CartaoMeta, CATEGORIAS, DiarioDoMes, PERGUNTAS, PostsPorMes,
  gruposDuplicados, nomeDoMes, useReflexoesAnteriores, type CampoReflexao,
} from "@/components/metas/QuadroMetas";

const sombra = "shadow-[5px_5px_0_hsl(var(--foreground))]";
const VAZIO = { title: "", category: "geral", target_value: "", observation: "", due_date: "" };

const Metas = () => {
  const { posts } = usePosts();
  const today = hojeBR();
  const [novaAberta, setNovaAberta] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [aberta, setAberta] = useState<string | null>(null);
  const [juntando, setJuntando] = useState(false);
  const [paginaAntiga, setPaginaAntiga] = useState<string | null>(null);

  const {
    structuredGoals: goals,
    milestones,
    createGoal,
    updateGoalProgress,
    updateGoalStatus,
    deleteGoal,
    createMilestone,
    updateMilestone,
    deleteMilestone,
  } = useGoals();

  /* META DE SEGUIDORES SE ATUALIZA SOZINHA (pedido do Walter, 31/08): com o
     Instagram conectado, o número real de seguidores vira o "onde estou" de
     toda meta da categoria Seguidores em andamento. Grava só quando difere. */
  const { data: dailyIG = [] } = useDailyMetrics(30);
  const comSeguidores = dailyIG.filter((d) => d.followers != null);
  const seguidoresIG = comSeguidores.length ? comSeguidores[comSeguidores.length - 1].followers! : null;
  // Ritmo: quanto mudou do primeiro ao último dia com número, levado a 30 dias.
  const ritmoSeguidores = (() => {
    if (comSeguidores.length < 2) return null;
    const a = comSeguidores[0], b = comSeguidores[comSeguidores.length - 1];
    const dias = Math.max(1, (new Date(b.date).getTime() - new Date(a.date).getTime()) / 86400000);
    return Math.round(((b.followers! - a.followers!) / dias) * 30);
  })();
  useEffect(() => {
    if (seguidoresIG == null) return;
    for (const g of goals) {
      if (g.category !== "seguidores" || g.status === "concluida") continue;
      if ((g.current_value ?? 0) === seguidoresIG) continue;
      updateGoalProgress.mutate({ id: g.id, current_value: seguidoresIG });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seguidoresIG, goals.length]);

  // Ativas primeiro; concluídas e pausadas vão pro fim.
  const ordenadas = useMemo(() => {
    const peso = (s: string) => (s === "em_andamento" ? 0 : s === "pausada" ? 1 : 2);
    return [...goals].sort((a, b) => peso(a.status) - peso(b.status));
  }, [goals]);
  const duplicadas = gruposDuplicados(goals);

  /* CRIAR TRAVA ENQUANTO SALVA. Em 29/08 um clique duplo criou duas metas
     iguais (0,7 s de diferença): o botão só travava com o título vazio. */
  const criar = async () => {
    if (!form.title.trim() || createGoal.isPending) return;
    try {
      await createGoal.mutateAsync({
        title: form.title.trim(),
        category: form.category,
        target_value: form.target_value ? parseFloat(form.target_value) : 0,
        observation: form.observation || null,
        end_date: form.due_date || null,
        status: "em_andamento",
      });
      setForm(VAZIO);
      setNovaAberta(false);
      toast.success("Meta criada.");
    } catch {
      toast.error("Não deu pra criar a meta. Tente de novo.");
    }
  };

  // "Ficar com uma": fica a mais antiga (ou a que tem mais marcos) e apaga as cópias.
  const ficarComUma = async (grupo: typeof goals) => {
    const marcosDe = (id: string) => milestones.filter((m) => m.goal_id === id).length;
    const fica = [...grupo].sort((a, b) => marcosDe(b.id) - marcosDe(a.id) || (a.created_at ?? "").localeCompare(b.created_at ?? ""))[0];
    const sair = grupo.filter((g) => g.id !== fica.id);
    const ok = await confirmar({
      titulo: `Apagar ${sair.length === 1 ? "a cópia" : `as ${sair.length} cópias`}?`,
      descricao: `Fica uma meta "${fica.title}". ${sair.length === 1 ? "A outra é apagada" : "As outras são apagadas"} junto com os marcos dela.`,
      acao: "Ficar com uma",
      destrutivo: true,
    });
    if (!ok) return;
    setJuntando(true);
    try {
      for (const g of sair) await deleteGoal.mutateAsync(g.id);
      toast.success("Pronto, ficou uma.");
    } catch {
      toast.error("Não deu pra apagar a cópia. Tente de novo.");
    } finally { setJuntando(false); }
  };

  const remover = async (id: string) => {
    if (!(await confirmar({ titulo: "Remover esta meta?", descricao: "Os marcos dela saem junto.", acao: "Remover", destrutivo: true }))) return;
    try { await deleteGoal.mutateAsync(id); toast.success("Meta removida."); } catch { toast.error("Erro ao remover meta."); }
  };

  /* ─── reflexão do mês ─── */
  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-01`;
  const { reflection, saveReflection } = useReflections(mesAtual);
  const valores = useMemo(() => {
    const v = {} as Record<CampoReflexao, string>;
    for (const p of PERGUNTAS) v[p.key] = (reflection?.[p.key] as string | null) ?? "";
    return v;
  }, [reflection]);
  const salvarCampo = async (k: CampoReflexao, texto: string) => {
    const tudo: Record<string, string | null> = {};
    for (const p of PERGUNTAS) tudo[p.key] = (p.key === k ? texto : valores[p.key]) || null;
    try { await saveReflection.mutateAsync(tudo); } catch { toast.error("Não deu pra salvar a reflexão."); }
  };
  const { data: anteriores = [] } = useReflexoesAnteriores(mesAtual);
  const pagina = anteriores.find((r) => r.month === paginaAntiga) ?? null;

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-5">
          <h1 className="md:hidden text-[26px] font-display font-extrabold tracking-tight">Metas</h1>
          <p className="hidden md:block text-[14px] font-body text-muted-foreground">Onde você está, quanto falta e quando chega.</p>
          <button type="button" data-tour="metas-nova" onClick={() => setNovaAberta(true)}
            className={cn("ml-auto inline-flex items-center gap-1.5 h-10 rounded-full border-2 border-foreground bg-[#EB4918] px-4 text-[13px] font-body font-extrabold text-white", "shadow-[3px_3px_0_hsl(var(--foreground))]")}>
            <Plus className="h-4 w-4" /> <span className="sm:hidden">Nova</span><span className="hidden sm:inline">Nova meta</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 items-start">
          {/* QUADRO DE METAS */}
          <div className="space-y-5 min-w-0">
            {duplicadas.map((g) => (
              <AvisoDuplicadas key={g[0].id} grupo={g} ocupado={juntando} onFicarComUma={() => void ficarComUma(g)} />
            ))}

            {novaAberta && (
              <div className={cn("rounded-2xl border-2 border-foreground bg-[#FFFCF3] dark:bg-card p-4 sm:p-5 space-y-3", sombra)}>
                <div className="flex items-center">
                  <p className="font-display font-extrabold text-[17px]">Nova meta</p>
                  <button type="button" onClick={() => setNovaAberta(false)} aria-label="Fechar" className="ml-auto p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Alcançar 10 mil seguidores"
                  className="w-full h-11 rounded-lg border-2 border-foreground bg-card px-3 text-[15px] font-body font-semibold outline-none" />
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIAS.map((c) => (
                    <button key={c.value} type="button" onClick={() => setForm({ ...form, category: c.value })} aria-pressed={form.category === c.value}
                      className={cn("h-8 rounded-full border-2 px-3 text-[12px] font-body font-bold text-[#1d1b18]", form.category === c.value ? "border-foreground" : "border-transparent opacity-70")}
                      style={{ background: c.cor }}>{c.label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[12px] font-body font-semibold">Alvo
                    <input type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} placeholder="10000"
                      className="mt-1 w-full h-10 rounded-lg border-2 border-foreground bg-card px-3 text-[14px] tabular-nums" />
                  </label>
                  <label className="text-[12px] font-body font-semibold">Prazo (opcional)
                    <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="mt-1 w-full h-10 rounded-lg border-2 border-foreground bg-card px-3 text-[14px]" />
                  </label>
                </div>
                <input value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} placeholder="Observação (opcional)"
                  className="w-full h-10 rounded-lg border-2 border-foreground/30 focus:border-foreground bg-card px-3 text-[13px] font-body outline-none" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setNovaAberta(false)} className="h-9 px-4 text-[13px] font-body font-bold text-muted-foreground">Cancelar</button>
                  <button type="button" onClick={() => void criar()} disabled={!form.title.trim() || createGoal.isPending}
                    className="h-9 rounded-full border-2 border-foreground bg-foreground px-4 text-[13px] font-body font-extrabold text-background disabled:opacity-50">
                    {createGoal.isPending ? "Criando..." : "Criar meta"}
                  </button>
                </div>
              </div>
            )}

            {ordenadas.length === 0 && !novaAberta ? (
              <div className={cn("rounded-2xl border-2 border-foreground bg-card p-8 text-center", sombra)}>
                <p className="font-display font-extrabold text-[18px]">Nenhuma meta ainda</p>
                <p className="text-[13px] font-body text-muted-foreground mt-1">Toque em Nova meta. A de seguidores se atualiza sozinha com o Instagram conectado.</p>
              </div>
            ) : (
              ordenadas.map((g) => (
                <CartaoMeta key={g.id} goal={g} today={today}
                  marcos={milestones.filter((m) => m.goal_id === g.id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))}
                  aberto={aberta === g.id} onAbrir={() => setAberta(aberta === g.id ? null : g.id)}
                  auto={g.category === "seguidores" && seguidoresIG != null}
                  ritmoMes={g.category === "seguidores" ? ritmoSeguidores : null}
                  onValor={(v) => updateGoalProgress.mutate({ id: g.id, current_value: v }, { onError: () => toast.error("Erro ao atualizar valor.") })}
                  onStatus={(s) => updateGoalStatus.mutate({ id: g.id, status: s }, { onError: () => toast.error("Erro ao atualizar.") })}
                  onRemover={() => void remover(g.id)}
                  onMarco={(m) => updateMilestone.mutate({ id: m.id, updates: { completed: !m.completed, completed_at: !m.completed ? new Date().toISOString() : null } })}
                  onNovoMarco={(nome) => createMilestone.mutate({ goal_id: g.id, name: nome, position: milestones.filter((m) => m.goal_id === g.id).length }, { onError: () => toast.error("Erro ao adicionar marco.") })}
                  onRemoverMarco={(id) => deleteMilestone.mutate(id)}
                />
              ))
            )}
          </div>

          {/* LADO: visão anual + diário */}
          <div className="space-y-6 min-w-0">
            <PostsPorMes posts={posts} />

            <div data-tour="metas-reflexao" className={cn("relative rounded-2xl border-2 border-foreground bg-[#FFFCF3] dark:bg-card overflow-hidden", sombra)}
              style={{ backgroundImage: "linear-gradient(90deg, transparent 30px, #F3B7B0 30px 32px, transparent 32px), repeating-linear-gradient(transparent 0 31px, rgba(201,182,150,.35) 31px 32px)" }}>
              <div className="pl-11 pr-4 sm:pr-5 py-4">
                <p className="font-display font-extrabold text-[17px]">
                  Reflexão de {nomeDoMes(mesAtual)} <span className="text-[12px] font-body font-semibold text-muted-foreground">{PERGUNTAS.filter((p) => valores[p.key]?.trim()).length} de 6</span>
                </p>
                <div className="mt-2">
                  <DiarioDoMes mesNome={nomeDoMes(mesAtual)} valores={valores} onSalvarCampo={(k, v) => void salvarCampo(k, v)} salvando={saveReflection.isPending} />
                </div>
                {anteriores.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12.5px] font-body font-extrabold mr-1">Páginas anteriores</span>
                    {anteriores.map((r) => (
                      <button key={r.id} type="button" onClick={() => setPaginaAntiga(paginaAntiga === r.month ? null : r.month)} aria-pressed={paginaAntiga === r.month}
                        className={cn("h-7 rounded-full border-2 border-foreground px-3 text-[11.5px] font-body font-bold", paginaAntiga === r.month ? "bg-foreground text-background" : "bg-card")}>
                        {nomeDoMes(r.month)}
                      </button>
                    ))}
                  </div>
                )}
                {pagina && (
                  <div className="mt-3 rounded-xl border-2 border-foreground bg-card p-3 space-y-2">
                    <p className="font-display font-extrabold text-[14px] capitalize">{nomeDoMes(pagina.month)}</p>
                    {PERGUNTAS.filter((p) => (pagina[p.key] as string | null)?.trim()).map((p) => (
                      <div key={p.key}>
                        <p className="text-[11.5px] font-body font-bold text-muted-foreground">{p.rotulo}</p>
                        <p className="text-[13.5px] font-body whitespace-pre-wrap">{pagina[p.key] as string}</p>
                      </div>
                    ))}
                    {!PERGUNTAS.some((p) => (pagina[p.key] as string | null)?.trim()) && (
                      <p className="text-[13px] font-body italic text-muted-foreground">Esta página ficou em branco.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Metas;

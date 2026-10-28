import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Check, RefreshCw, Wand2, ChevronDown, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePillars } from "@/hooks/usePillars";
import { usePosts } from "@/hooks/usePosts";
import { useBrandContext } from "@/hooks/useBrandContext";
import { useResumoDesempenho } from "@/hooks/useResumoDesempenho";
import { generateAutopilot, callAIContextBuilder, type AutopilotPost, type ConceitoPlano } from "@/lib/ai/claude";
import { bestTimes } from "@/lib/bestTimes";
import { FORMAT_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toISODateBR } from "@/lib/date-br";
import { cn } from "@/lib/utils";
import { CrIA } from "@/components/brand/CrIA";
import { TrendPickerDialog, Chip } from "@/components/tendencias/TrendPickerDialog";
import { useTendencias, tendenciasParaIA, registrarUsoTendencias, type Tendencia } from "@/hooks/useTendencias";
import { proximasDatas, dataCurta } from "@/lib/datasComerciais";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA PLANO v2 (28/10/2026, mockup aprovado, aba 4)

   1. Conceito: a Cria IA lê as tendências marcadas e a marca e propõe 4
      conceitos (o fio do plano). A pessoa escolhe 1, mistura 2 ou escreve o seu.
   2. Ritmo numa linha: período, posts por semana, onde e horário.
   3. Resultado com fio: resumo (mix de formatos, pilares, datas) e a lista
      semana a semana, cada post com gancho e porquê. "Trocar ideia" refaz um
      post sem refazer o plano; desmarcar tira; o botão conta quantos vão.
   ═══════════════════════════════════════════════════════════════════════════ */

const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;

type RunRow = { id: string; periodo: string; foco: string | null; qtd: number; posts: AutopilotPost[]; created_at: string };
type Item = AutopilotPost & { id: number; selected: boolean; date: string; time: string; semana: number };
type Resumo = { titulo?: string; fio?: string };

const CORES = ["#EA4918", "#5B3FD6", "#B0246A", "#1F5C3F"];
const PERIODOS: Array<[number, string]> = [[1, "1 semana"], [2, "2 semanas"], [4, "Mês"]];
const COR_FORMATO: Record<string, string> = { reels: "#EA4918", carrossel: "#5B3FD6", foto: "#1F5C3F" };
const DIA_CURTO = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const CONCEITOS_KEY = "cria_plano_conceitos_v1";

function deriveUserSlots(list: { scheduled_time?: string | null }[]): string[] | null {
  const counts: Record<string, number> = {};
  let n = 0;
  for (const p of list) {
    const t = p.scheduled_time;
    if (!t) continue;
    const hh = t.slice(0, 2);
    if (!/^\d{2}$/.test(hh)) continue;
    counts[hh] = (counts[hh] || 0) + 1; n++;
  }
  if (n < 4) return null;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => `${h}:00`);
  return top.length ? [...new Set(top)].sort() : null;
}

/** Conceitos ficam guardados no aparelho por 3 dias: voltar na página não
 *  gasta geração da Cria IA. "Outros conceitos" pede novos. */
function lerConceitosSalvos(conta: string | null): ConceitoPlano[] | null {
  try {
    const raw = localStorage.getItem(`${CONCEITOS_KEY}:${conta}`);
    if (!raw) return null;
    const j = JSON.parse(raw) as { em: number; lista: ConceitoPlano[] };
    if (Date.now() - j.em > 3 * 86400000) return null;
    return j.lista?.length ? j.lista : null;
  } catch { return null; }
}
function salvarConceitos(conta: string | null, lista: ConceitoPlano[]) {
  try { localStorage.setItem(`${CONCEITOS_KEY}:${conta}`, JSON.stringify({ em: Date.now(), lista })); } catch { /* ok */ }
}

export default function Autopilot() {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const { profile } = useActiveProfile();
  const { pillars } = usePillars();
  const { posts, createPost } = usePosts();
  const { brandContext, hasBrandContext } = useBrandContext();
  const { data: tendencias } = useTendencias();
  const desempenho = useResumoDesempenho();
  const qc = useQueryClient();
  const location = useLocation();
  const vindas = useMemo(() => (location.state as { tendencias?: string[] } | null)?.tendencias ?? [], [location.state]);

  /* 1. base de tendências: as que vieram da página Tendências, ou as 3 mais novas de posts. */
  const [base, setBase] = useState<string[] | null>(null);
  useEffect(() => {
    if (base !== null || !tendencias.length) return;
    const ini = vindas.length ? vindas : tendencias.filter((t) => t.fonte === "conteudo").slice(0, 3).map((t) => t.chave);
    setBase(ini);
  }, [tendencias, base, vindas]);
  const baseLista = useMemo(() => tendencias.filter((t) => (base ?? []).includes(t.chave)), [tendencias, base]);
  const chipsTend = useMemo(() => {
    const vis = tendencias.filter((t) => t.fonte === "conteudo").slice(0, 4).map((t) => t.chave);
    return [...new Set([...(base ?? []), ...vis])].map((c) => tendencias.find((t) => t.chave === c)).filter(Boolean) as Tendencia[];
  }, [tendencias, base]);
  const [picker, setPicker] = useState(false);

  const [conceitos, setConceitos] = useState<ConceitoPlano[] | null>(() => lerConceitosSalvos(activeAccountId));
  const [gerandoConceitos, setGerandoConceitos] = useState(false);
  const [selC, setSelC] = useState<string[]>([]);
  const [livre, setLivre] = useState("");

  const datas = useMemo(() => proximasDatas(new Date(), 4), []);
  const recentes = useMemo(() => posts.slice(0, 15).map((p) => p.title).filter(Boolean).join("; "), [posts]);

  const pedirConceitos = async (evitar?: string) => {
    if (gerandoConceitos) return;
    setGerandoConceitos(true);
    try {
      const res = (await callAIContextBuilder({
        operation: "autopilot-conceitos",
        data: {
          nicho: profile?.niche ?? undefined,
          pilares: pillars.map((p) => p.name).join(", ") || undefined,
          escolhidas: baseLista.length ? tendenciasParaIA(baseLista) : undefined,
          tendencias: tendenciasParaIA(tendencias.filter((t) => t.fonte === "conteudo")),
          datas: datas.map((d) => `${d.nome} ${dataCurta(d.iso)} (faltam ${d.diasAte} dias)`).join("; "),
          performou: desempenho.texto || undefined,
          recentes: recentes || undefined,
          evitar,
          brandContext: hasBrandContext ? brandContext : undefined,
        },
      })) as { conceitos?: ConceitoPlano[] };
      const lista = (res?.conceitos ?? []).filter((c) => c?.nome).slice(0, 4);
      if (!lista.length) throw new Error("vazio");
      setConceitos(lista);
      setSelC([lista[0].nome]);
      salvarConceitos(activeAccountId, lista);
      if (baseLista.length) registrarUsoTendencias(baseLista, "cria-plano-conceitos");
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      toast.error(/upgrade/i.test(m) ? "O Cria Plano é do plano Studio." : "Não consegui trazer os conceitos agora. Tente de novo.");
    } finally {
      setGerandoConceitos(false);
    }
  };
  // primeira visita sem conceitos guardados: pede assim que as tendências chegam
  const [pediuAuto, setPediuAuto] = useState(false);
  useEffect(() => {
    if (conceitos === null && base !== null && !pediuAuto) { setPediuAuto(true); void pedirConceitos(); }
    if (conceitos && selC.length === 0) setSelC([conceitos[0].nome]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, conceitos]);

  /* 2. ritmo */
  const [semanas, setSemanas] = useState(4);
  const [porSemana, setPorSemana] = useState(3);
  const [onde, setOnde] = useState<string[]>(["instagram"]);
  const [usarPico, setUsarPico] = useState(true);
  const habito = useMemo(() => deriveUserSlots(posts), [posts]);
  const userSlots = desempenho.horarios?.slots ?? habito;
  const slots = useMemo(
    () => (usarPico && userSlots ? userSlots : bestTimes(onde[0] ?? "instagram", profile?.niche).slots),
    [usarPico, userSlots, onde, profile?.niche],
  );

  /* 3. resultado */
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [resumo, setResumo] = useState<Resumo>({});
  const [semanaVis, setSemanaVis] = useState(1);
  const [editando, setEditando] = useState<number | null>(null);
  const [trocando, setTrocando] = useState<number | null>(null);

  const escolhidos = useMemo(() => {
    const l = (conceitos ?? []).filter((c) => selC.includes(c.nome));
    return livre.trim() ? [...l, { nome: livre.trim(), lead: "", agora: "", usa: [], mix: "", exemplos: [] }] : l;
  }, [conceitos, selC, livre]);
  const corDo = (nome?: string) => {
    const i = (conceitos ?? []).findIndex((c) => c.nome === nome);
    return i >= 0 ? CORES[i % CORES.length] : "#1F1A17";
  };

  const { data: runs = [] } = useQuery<RunRow[]>({
    queryKey: ["autopilot-runs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("autopilot_runs").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data as RunRow[]) ?? [];
    },
  });

  /* Datas: semana w começa amanhã + 7*(w-1); os posts da semana se espalham nos dias. */
  const montarItens = (raw: AutopilotPost[], nSemanas: number, nPorSemana: number): Item[] => {
    const porSem: Record<number, AutopilotPost[]> = {};
    raw.forEach((p, i) => {
      const w = Math.max(1, Math.min(nSemanas, Number(p.semana) || Math.floor(i / Math.max(1, nPorSemana)) + 1));
      (porSem[w] ??= []).push(p);
    });
    const out: Item[] = [];
    let id = 0;
    for (let w = 1; w <= nSemanas; w++) {
      const lista = porSem[w] ?? [];
      lista.forEach((p, j) => {
        const d = new Date();
        d.setDate(d.getDate() + 1 + (w - 1) * 7 + Math.floor((j * 7) / Math.max(1, lista.length)));
        out.push({ ...p, id: id++, selected: true, semana: w, date: toISODateBR(d), time: slots[j % Math.max(1, slots.length)] ?? "18:00" });
      });
    }
    return out;
  };

  const montarPlano = async () => {
    if (loading) return;
    if (!escolhidos.length) { toast.error("Escolha um conceito ou escreva o seu."); return; }
    setLoading(true);
    setItems([]);
    try {
      const qtd = semanas * porSemana;
      const res = await generateAutopilot({
        nicho: profile?.niche ?? undefined,
        plataformas: onde.join(", "),
        pilares: pillars.map((p) => p.name).join(", ") || undefined,
        qtd,
        periodo: semanas === 4 ? "mes" : `${semanas} semana${semanas > 1 ? "s" : ""}`,
        semanas,
        conceitos: escolhidos.map((c) => `${c.nome}${c.lead ? `: ${c.lead}` : ""}`).join(" | "),
        recentes: recentes || undefined,
        performou: desempenho.texto || undefined,
        tendencias: baseLista.length ? tendenciasParaIA(baseLista) : undefined,
        contexto: datas.filter((d) => d.diasAte <= semanas * 7).map((d) => `${d.nome} em ${dataCurta(d.iso)}`).join("; ") || undefined,
        brandContext: hasBrandContext ? brandContext : undefined,
      }, user?.id);
      if (!res?.posts?.length) throw new Error("vazio");
      setItems(montarItens(res.posts, semanas, porSemana));
      setResumo(res.resumo ?? {});
      setSemanaVis(1);
      setTimeout(() => document.getElementById("plano-resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(/upgrade/i.test(msg) ? "O Cria Plano é do plano Studio." : msg && !/non-2xx|vazio/i.test(msg) ? `Erro: ${msg}` : "Não consegui montar agora. Tenta de novo em instantes.");
    } finally {
      setLoading(false);
    }
  };

  const trocarIdeia = async (it: Item) => {
    if (trocando !== null) return;
    setTrocando(it.id);
    try {
      const res = await generateAutopilot({
        nicho: profile?.niche ?? undefined, plataformas: onde.join(", "), qtd: 1,
        conceitos: escolhidos.map((c) => c.nome).join(" | "),
        pilares: pillars.map((p) => p.name).join(", ") || undefined,
        trocar: { formato: it.formato, conceito: it.conceito, titulo: it.titulo, outros: items.map((x) => x.titulo).join("; ") },
        brandContext: hasBrandContext ? brandContext : undefined,
      }, user?.id);
      const novo = res?.posts?.[0];
      if (!novo) throw new Error("vazio");
      setItems((l) => l.map((x) => (x.id === it.id ? { ...x, ...novo, semana: x.semana, conceito: novo.conceito || x.conceito } : x)));
    } catch {
      toast.error("Não consegui trocar agora.");
    } finally {
      setTrocando(null);
    }
  };

  const patch = (id: number, p: Partial<Item>) => setItems((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const selecionados = items.filter((i) => i.selected);

  const enviar = async () => {
    if (!selecionados.length) { toast.error("Marque ao menos um post."); return; }
    setSending(true);
    try {
      for (const it of selecionados) {
        const pillar = pillars.find((p) => p.name.toLowerCase() === (it.pilar || "").toLowerCase());
        await createPost.mutateAsync({
          title: it.titulo,
          hook: it.gancho || null,
          caption: it.legenda || null,
          platform: it.plataforma || onde[0] || "instagram",
          format: (it.formato || "reels").toLowerCase(),
          pillar_id: pillar?.id ?? null,
          // Vai pra Planejamento (roteiro): é pauta pronta esperando produção.
          status: "roteiro",
          scheduled_date: it.date || null,
          scheduled_time: it.time || null,
        });
      }
      await sbFrom("autopilot_runs").insert({ user_id: user!.id, periodo: semanas === 4 ? "mes" : "semana", foco: escolhidos.map((c) => c.nome).join(" + ") || null, qtd: items.length, posts: items });
      qc.invalidateQueries({ queryKey: ["autopilot-runs", user?.id] });
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast.success(`${selecionados.length} post${selecionados.length > 1 ? "s" : ""} no Criando, em Planejamento.`);
      setItems([]);
    } catch (e) {
      console.error("cria plano send failed", e);
      toast.error("Erro ao mandar os posts.");
    } finally {
      setSending(false);
    }
  };

  const reabrir = (r: RunRow) => {
    const lista = r.posts ?? [];
    const n = Math.max(1, ...lista.map((p) => Number(p.semana) || 1));
    setItems(montarItens(lista, n, Math.ceil((lista.length || 1) / n)));
    setResumo({ titulo: `${r.qtd} posts · ${r.foco ?? "plano anterior"}` });
    setSemanaVis(1);
    toast.message("Plano reaberto. Ajuste e mande de novo quando quiser.");
  };

  /* mix de formatos do resultado */
  const mix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) { const f = (it.formato || "reels").toLowerCase(); m[f] = (m[f] ?? 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [items]);
  const pilaresUsados = [...new Set(items.map((i) => i.pilar).filter(Boolean))];
  const nSemanas = Math.max(1, ...items.map((i) => i.semana));
  const doPeriodo = items.length ? datas.filter((d) => d.iso <= items[items.length - 1].date) : [];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0 flex flex-col gap-3.5 max-w-[920px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-pink-400 flex items-center justify-center shadow-sm shrink-0">
            <Wand2 className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Cria Plano</h1>
            <p className="text-muted-foreground font-body text-sm mt-0.5">Escolha um conceito. A <CrIA /> monta o mês e você ajusta post por post.</p>
          </div>
        </div>
        {runs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">Planos anteriores <ChevronDown className="h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {runs.slice(0, 8).map((r) => (
                <DropdownMenuItem key={r.id} onClick={() => reabrir(r)}>
                  {new Date(r.created_at).toLocaleDateString("pt-BR")} · {r.qtd} posts{r.foco ? ` · ${r.foco}` : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 1. Conceito */}
      <section data-tour="plano-config" className="rounded-[22px] bg-card border border-border p-5 flex flex-col gap-3.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">1. Conceito do plano</p>
            <p className="text-[13px] font-body text-muted-foreground">A Cria IA leu as tendências e a sua marca. Escolha um ou misture dois.</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" disabled={gerandoConceitos}
            onClick={() => pedirConceitos((conceitos ?? []).map((c) => c.nome).join("; "))}>
            <RefreshCw className={cn("h-3.5 w-3.5", gerandoConceitos && "animate-spin")} /> Outros conceitos
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-body font-bold text-muted-foreground mr-1">Tendências na base:</span>
          {chipsTend.map((t) => (
            <Chip key={t.chave} on={(base ?? []).includes(t.chave)}
              onClick={() => setBase((b) => ((b ?? []).includes(t.chave) ? (b ?? []).filter((x) => x !== t.chave) : [...(b ?? []), t.chave]))}>{t.titulo}</Chip>
          ))}
          <Chip on={false} onClick={() => setPicker(true)}>+ Ver todas</Chip>
        </div>

        {gerandoConceitos && !conceitos ? (
          <div className="flex items-center gap-2.5 py-8 justify-center text-sm font-body text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> A Cria IA está pensando nos conceitos…</div>
        ) : (
          <div className={cn("grid gap-3 sm:grid-cols-2", gerandoConceitos && "opacity-50 pointer-events-none")}>
            {(conceitos ?? []).map((c, i) => {
              const on = selC.includes(c.nome);
              const cor = CORES[i % CORES.length];
              return (
                <button key={c.nome} type="button" aria-pressed={on}
                  onClick={() => setSelC((l) => (l.includes(c.nome) ? l.filter((x) => x !== c.nome) : l.length >= 2 ? [l[1], c.nome] : [...l, c.nome]))}
                  style={{ borderColor: on ? cor : undefined }}
                  className={cn("relative overflow-hidden text-left rounded-[22px] border-2 bg-card px-4 pt-5 pb-3.5 flex flex-col gap-2.5 transition-shadow", on ? "shadow-lg" : "border-border")}>
                  <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: cor }} />
                  <span className="absolute top-3.5 right-3.5 h-6 w-6 rounded-full border-2 grid place-items-center text-white"
                    style={on ? { background: cor, borderColor: cor } : undefined}>{on && <Check className="h-3.5 w-3.5" />}</span>
                  <h3 className="font-display font-extrabold text-lg leading-tight pr-8">{c.nome}</h3>
                  <p className="text-[13px] font-body text-muted-foreground">{c.lead}</p>
                  {c.agora && <p className="text-xs font-body font-bold rounded-[10px] bg-muted px-2.5 py-2" style={{ color: cor }}>✦ {c.agora}</p>}
                  {c.usa?.length > 0 && (
                    <div className="flex flex-wrap gap-1">{c.usa.map((u) => <span key={u} className="text-[11px] font-body font-bold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">{u}</span>)}</div>
                  )}
                  {c.exemplos?.length > 0 && (
                    <div className="flex flex-col gap-1 border-t border-dashed border-border pt-2.5">
                      {c.exemplos.map((e) => <span key={e} className="text-[12.5px] font-body text-foreground"><span className="text-muted-foreground">→ </span>{e}</span>)}
                    </div>
                  )}
                  {c.mix && <span className="text-[11.5px] font-body font-bold text-muted-foreground">{c.mix}</span>}
                </button>
              );
            })}
            <div className="rounded-[22px] border-2 border-dashed border-border px-4 py-4 flex flex-col gap-2">
              <h3 className="font-display font-extrabold text-lg">Do meu jeito</h3>
              <p className="text-[13px] font-body text-muted-foreground">Escreva o conceito e a Cria IA monta em cima, usando as tendências marcadas.</p>
              <Input value={livre} onChange={(e) => setLivre(e.target.value)} placeholder="Ex.: mês das perguntas dos seguidores" className="rounded-2xl h-11" />
            </div>
          </div>
        )}
      </section>

      {/* 2. Ritmo */}
      <section className="rounded-[22px] bg-card border border-border p-5 flex flex-col gap-3">
        <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">2. Ritmo</p>
        <div className="flex flex-wrap items-end gap-3.5">
          <Grupo rotulo="Período">
            <div className="flex rounded-xl border-[1.5px] border-border overflow-hidden min-w-[250px]">
              {PERIODOS.map(([n, r]) => (
                <button key={n} type="button" aria-pressed={semanas === n} onClick={() => setSemanas(n)}
                  className={cn("flex-1 px-2 py-2 text-[12.5px] font-body font-bold", semanas === n ? "bg-foreground text-background" : "bg-card")}>{r}</button>
              ))}
            </div>
          </Grupo>
          <Grupo rotulo="Posts por semana">
            <div className="flex items-center rounded-xl border-[1.5px] border-border overflow-hidden bg-card">
              <button type="button" aria-label="Menos" className="w-9 h-9 text-lg" onClick={() => setPorSemana((q) => Math.max(1, q - 1))}>−</button>
              <b className="min-w-[34px] text-center font-display font-extrabold">{porSemana}</b>
              <button type="button" aria-label="Mais" className="w-9 h-9 text-lg" onClick={() => setPorSemana((q) => Math.min(7, q + 1))}>+</button>
            </div>
          </Grupo>
          <Grupo rotulo="Onde">
            <div className="flex gap-1.5">
              {[["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"]].map(([k, r]) => (
                <Chip key={k} on={onde.includes(k)} onClick={() => setOnde((l) => (l.includes(k) ? (l.length > 1 ? l.filter((x) => x !== k) : l) : [...l, k]))}>{r}</Chip>
              ))}
            </div>
          </Grupo>
          <Grupo rotulo="Horário">
            <Chip on={usarPico && !!userSlots} onClick={() => setUsarPico((v) => !v)}>{userSlots ? "Meus horários de pico" : "Recomendado do nicho"}</Chip>
          </Grupo>
        </div>
        <p className="text-[12.5px] font-body text-muted-foreground">
          A Cria IA também usa: <b className="text-emerald-700 dark:text-emerald-400">{hasBrandContext ? "✓" : "○"}</b> brandbook · <b className="text-emerald-700 dark:text-emerald-400">{pillars.length ? "✓" : "○"}</b> pilares · <b className="text-emerald-700 dark:text-emerald-400">{desempenho.texto ? "✓" : "○"}</b> o que já performou · <b className="text-emerald-700 dark:text-emerald-400">✓</b> o que já está no Criando (pra não repetir)
          {!hasBrandContext && <> · <a href="/app/brandbook" className="text-primary font-semibold">preencher brandbook</a></>}
        </p>
        <div>
          <Button data-tour="plano-gerar" className="rounded-full" onClick={montarPlano} disabled={loading || !escolhidos.length}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span aria-hidden>✦</span>}
            {loading ? "Montando…" : <>Montar o plano com a <CrIA sobreLaranja /></>}
          </Button>
        </div>
      </section>

      {/* 3. Resultado */}
      <section id="plano-resultado" data-tour="plano-resultado" className="flex flex-col gap-3 scroll-mt-20">
        {loading && (
          <div className="rounded-[22px] bg-card border border-border p-5 flex items-center gap-2.5 font-body font-bold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> A Cria IA está montando o plano com {escolhidos.length} conceito{escolhidos.length > 1 ? "s" : ""}…
          </div>
        )}
        {items.length > 0 && (
          <>
            <div className="rounded-[22px] bg-card border border-border p-5 grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div>
                <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">3. Seu plano · {dataCurta(items[0].date)} a {dataCurta(items[items.length - 1].date)}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {escolhidos.map((c) => <span key={c.nome} className="text-[11px] font-body font-bold rounded-full px-2.5 py-0.5 text-white" style={{ background: corDo(c.nome) }}>{c.nome}</span>)}
                </div>
                <h2 className="font-display font-extrabold text-[22px] leading-tight mt-1.5">{resumo.titulo || `${items.length} posts em ${nSemanas} semana${nSemanas > 1 ? "s" : ""}`}</h2>
                {resumo.fio && <p className="text-[13px] font-body text-muted-foreground">{resumo.fio}</p>}
                <div className="flex h-3.5 rounded-full overflow-hidden my-2">
                  {mix.map(([f, n]) => <i key={f} style={{ flex: n, background: COR_FORMATO[f] ?? "#B0246A" }} />)}
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-body text-muted-foreground">
                  {mix.map(([f, n]) => (
                    <span key={f} className="inline-flex items-center gap-1.5">
                      <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: COR_FORMATO[f] ?? "#B0246A" }} />{n} {FORMAT_LABELS[f] ?? f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Kv k="Pilares" v={pilaresUsados.join(" · ") || "Do seu brandbook"} />
                <Kv k="Datas" v={doPeriodo.map((d) => `${d.nome} ${dataCurta(d.iso)}`).join(" · ") || "Nenhuma no período"} />
                <Kv k="Horários" v={slots.join(" e ")} />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: nSemanas }, (_, i) => i + 1).map((w) => (
                <Chip key={w} on={semanaVis === w} onClick={() => setSemanaVis(w)}>Semana {w}</Chip>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {items.filter((it) => it.semana === semanaVis).map((it) => {
                const d = new Date(it.date + "T00:00:00");
                const cor = corDo(it.conceito);
                return (
                  <div key={it.id} className={cn("grid grid-cols-[52px_minmax(0,1fr)] sm:grid-cols-[64px_minmax(0,1fr)_auto] gap-3.5 items-center rounded-[18px] bg-card border border-border px-3.5 py-3 transition-opacity", !it.selected && "opacity-45")}>
                    <div className="rounded-[14px] bg-muted text-center py-2 leading-tight">
                      <small className="block text-[11px] font-body font-bold text-muted-foreground">{DIA_CURTO[d.getDay()]}</small>
                      <b className="block font-display font-extrabold text-lg">{d.getDate()}</b>
                      <small className="block text-[11px] font-body font-bold text-muted-foreground">{it.time}</small>
                    </div>
                    <div className="min-w-0 flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-body font-bold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">{FORMAT_LABELS[(it.formato || "").toLowerCase()] ?? it.formato}</span>
                        {it.conceito && <span className="text-[11px] font-body font-bold rounded-full px-2 py-0.5 text-white" style={{ background: cor }}>{it.conceito}</span>}
                      </div>
                      {editando === it.id ? (
                        <div className="flex flex-col gap-1.5">
                          <Input value={it.titulo} onChange={(e) => patch(it.id, { titulo: e.target.value })} className="h-9 rounded-xl" aria-label="Título" />
                          <Input value={it.gancho ?? ""} onChange={(e) => patch(it.id, { gancho: e.target.value })} className="h-9 rounded-xl" aria-label="Gancho" placeholder="Gancho" />
                          <Textarea value={it.legenda} onChange={(e) => patch(it.id, { legenda: e.target.value })} rows={3} className="rounded-xl text-[13px]" aria-label="Legenda" />
                          <div className="flex gap-1.5">
                            <Input type="date" value={it.date} onChange={(e) => e.target.value && patch(it.id, { date: e.target.value })} className="h-9 rounded-xl w-[150px]" />
                            <Input type="time" value={it.time} onChange={(e) => patch(it.id, { time: e.target.value })} className="h-9 rounded-xl w-[110px]" />
                          </div>
                        </div>
                      ) : (
                        <>
                          <h4 className="font-display font-bold text-[15px] leading-snug">{trocando === it.id ? "Trocando…" : it.titulo}</h4>
                          {it.gancho && <span className="text-[12.5px] font-body text-muted-foreground">Gancho: <q className="text-foreground">{it.gancho}</q></span>}
                          {it.porque && <span className="text-[11.5px] font-body font-bold text-violet-700 dark:text-violet-300">✦ {it.porque}</span>}
                        </>
                      )}
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" className="rounded-full h-8" disabled={trocando !== null} onClick={() => trocarIdeia(it)}>
                        <RefreshCw className={cn("h-3.5 w-3.5", trocando === it.id && "animate-spin")} /> Trocar ideia
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full h-8" onClick={() => setEditando((e) => (e === it.id ? null : it.id))}>{editando === it.id ? "Pronto" : "Editar"}</Button>
                      <button type="button" aria-label={it.selected ? "Tirar do plano" : "Voltar pro plano"} onClick={() => patch(it.id, { selected: !it.selected })}
                        className={cn("h-[26px] w-[26px] rounded-lg border-2 grid place-items-center", it.selected ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                        {it.selected ? <Check className="h-3.5 w-3.5" /> : <X className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+84px)] md:bottom-3 z-20 rounded-[20px] bg-foreground text-background px-3.5 py-3 flex flex-wrap items-center justify-between gap-2.5 shadow-xl">
              <span className="text-sm font-body">{selecionados.length} de {items.length} no plano</span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-full border-white/30 bg-transparent text-background hover:bg-white/10" onClick={montarPlano} disabled={loading}>
                  <RefreshCw className="h-3.5 w-3.5" /> Gerar de novo
                </Button>
                <Button size="sm" className="rounded-full" onClick={enviar} disabled={sending || !selecionados.length}>
                  {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Mandar {selecionados.length} pro Criando
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <TrendPickerDialog open={picker} onOpenChange={setPicker} titulo="Tendências na base do plano" max={5} preferir="conteudo"
        subtitulo="Marque até 5. Os conceitos e o plano saem delas." botao="Usar no plano" iniciais={base ?? []}
        onConfirmar={(l) => setBase(l.map((t) => t.chave))} />
    </motion.div>
  );
}

function Grupo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">{rotulo}</span>
      {children}
    </div>
  );
}
function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2.5 text-[12.5px] font-body flex justify-between gap-2.5">
      <span className="text-muted-foreground">{k}</span><b className="font-display text-right">{v}</b>
    </div>
  );
}

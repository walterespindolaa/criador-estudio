import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Archive, ArrowDown, ArrowUp, ExternalLink, Loader2, Repeat2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type Post } from "@/hooks/usePosts";
import { usePillars } from "@/hooks/usePillars";
import { useHistoricoPosts, useLeiturasIg, useJuntarPilares, useJuntarPilaresDisponivel } from "@/hooks/useHistorico";
import { RepurposeSheet } from "@/components/kanban/RepurposeSheet";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { confirmar } from "@/components/shared/Confirm";
import { FORMAT_LABELS } from "@/lib/constants";
import { toISODateBR } from "@/lib/date-br";
import {
  CRITERIOS, PERIODOS, compacto, dentro, faixaDoHorario, janelas, nomeDoMes, numerosDoPost, pilaresRepetidos,
  porGrupo, porque, ranking, resumir, temNumeros, variacao,
  type Criterio, type Numeros, type Periodo,
} from "@/lib/historico";

/* ═══════════════════════════════════════════════════════════════════════════
   HISTÓRICO (Walter, 07/11/2026; mockup aprovado: "o histórico poderia ser
   mais útil e com mais dados"). Antes: quantos posts saíram por mês. Agora:
   o que funcionou e por quê, com os números que o Instagram já manda pro
   banco. As contas ficam em src/lib/historico.ts.
   ═══════════════════════════════════════════════════════════════════════════ */

type Linha = { p: Post; n: Numeros; capa: string | null; link: string | null };
type Coluna = "data" | "alcance" | "salvos" | "compart" | "curtidas" | "coment" | "seguidores";

const COR_FORMATO: Record<string, string> = { carrossel: "#EB4918", reels: "#0061EE", foto: "#00A652", story: "#FF77B9", video: "#7C3AED", shorts: "#C4302B", live: "#B45309" };
const formatoDe = (f: string | null) => FORMAT_LABELS[f ?? ""] ?? f ?? "Post";
const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "-");

const sel = "h-8 rounded-full border border-border bg-card px-3 pr-7 text-xs font-body font-semibold text-foreground appearance-none bg-no-repeat bg-[right_0.6rem_center] bg-[length:10px] max-w-[11rem] truncate";
const setinha = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.6' fill='none'/%3E%3C/svg%3E\")" };
const cartao = "rounded-[20px] border-2 border-foreground bg-card shadow-[0_4px_0_hsl(var(--foreground))]";

const Historico = () => {
  const { data: posts = [], isLoading } = useHistoricoPosts();
  const { data: leituras } = useLeiturasIg(useMemo(() => posts.map((p) => p.id), [posts]));
  const { pillars } = usePillars();
  const { data: podeJuntar = false } = useJuntarPilaresDisponivel();
  const juntar = useJuntarPilares();

  const [periodo, setPeriodo] = useState<Periodo>("90d");
  const [formato, setFormato] = useState("");
  const [pilar, setPilar] = useState("");
  const [rede, setRede] = useState("");
  const [busca, setBusca] = useState("");
  const [criterio, setCriterio] = useState<Criterio>("alcance");
  const [coluna, setColuna] = useState<Coluna>("data");
  const [desc, setDesc] = useState(true);
  const [quantos, setQuantos] = useState(20);
  const [reaproveitar, setReaproveitar] = useState<Post | null>(null);

  const nomePilar = useMemo(() => Object.fromEntries(pillars.map((p) => [p.id, p.name])) as Record<string, string>, [pillars]);

  const linhas = useMemo<Linha[]>(() => posts.map((p) => {
    const l = leituras?.get(p.id);
    return { p, n: numerosDoPost(p, l?.metrics), capa: p.cover_url || l?.thumbnail_url || null, link: p.ig_permalink || l?.permalink || null };
  }), [posts, leituras]);

  const formatosPresentes = useMemo(() => [...new Set(posts.map((p) => p.format).filter(Boolean) as string[])], [posts]);
  const redesPresentes = useMemo(() => [...new Set(posts.map((p) => p.platform).filter(Boolean) as string[])], [posts]);

  // Filtro sem o período (o período anterior usa os mesmos filtros).
  const casa = (l: Linha) =>
    (!formato || l.p.format === formato) && (!pilar || l.p.pillar_id === pilar) && (!rede || l.p.platform === rede)
    && (!busca.trim() || (l.p.title ?? "").toLowerCase().includes(busca.trim().toLowerCase()));

  const j = useMemo(() => janelas(periodo), [periodo]);
  const atuais = useMemo(() => linhas.filter((l) => casa(l) && dentro(l.p.published_at, j.atual)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, formato, pilar, rede, busca, j]);
  const anteriores = useMemo(() => (j.antes ? linhas.filter((l) => casa(l) && dentro(l.p.published_at, j.antes)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, formato, pilar, rede, busca, j]);

  const r = useMemo(() => resumir(atuais), [atuais]);
  const ra = useMemo(() => (j.antes ? resumir(anteriores) : null), [anteriores, j.antes]);

  const podio = useMemo(() => ranking(atuais, criterio), [atuais, criterio]);

  const grupos = useMemo(() => ({
    formato: porGrupo(atuais, (l) => l.p.format, formatoDe).slice(0, 4),
    pilar: porGrupo(atuais, (l) => l.p.pillar_id, (k) => nomePilar[k] ?? "Pilar removido").slice(0, 4),
    horario: porGrupo(atuais, (l) => (l.p.published_at ? faixaDoHorario(l.p.published_at) : null), (k) => k).slice(0, 4),
  }), [atuais, nomePilar]);

  const meses = useMemo(() => {
    const m = new Map<string, { posts: number; soma: number; com: number }>();
    for (const l of atuais) {
      if (!l.p.published_at) continue;
      const k = toISODateBR(new Date(l.p.published_at)).slice(0, 7);
      const g = m.get(k) ?? { posts: 0, soma: 0, com: 0 };
      g.posts++;
      if (l.n.alcance != null) { g.soma += l.n.alcance; g.com++; }
      m.set(k, g);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, g]) => ({
      mes: nomeDoMes(k).slice(0, 3), nome: nomeDoMes(k), posts: g.posts, alcance: g.com ? Math.round(g.soma / g.com) : null,
    }));
  }, [atuais]);

  const ordenadas = useMemo(() => {
    const v = (l: Linha) => (coluna === "data" ? (l.p.published_at ? new Date(l.p.published_at).getTime() : 0) : l.n[coluna] ?? -1);
    return [...atuais].sort((a, b) => (desc ? v(b) - v(a) : v(a) - v(b)));
  }, [atuais, coluna, desc]);

  const repetidos = useMemo(() => {
    const cont: Record<string, number> = {};
    for (const p of posts) if (p.pillar_id) cont[p.pillar_id] = (cont[p.pillar_id] ?? 0) + 1;
    return pilaresRepetidos(pillars.map((p) => ({ id: p.id, name: p.name, position: p.position })), cont);
  }, [pillars, posts]);

  const juntarAgora = async () => {
    const lista = repetidos.map((g) => `${g.saem.map((s) => `"${s.name}"`).join(", ")} vira "${g.fica.name}"`).join(". ");
    if (!(await confirmar({ titulo: "Juntar os pilares repetidos?", descricao: `${lista}. Os posts e as ideias passam pro pilar que fica e o repetido some.`, acao: "Juntar" }))) return;
    try {
      const n = await juntar.mutateAsync(repetidos.map((g) => ({ fica: g.fica.id, saem: g.saem.map((s) => s.id) })));
      toast.success(`Pilares juntados. ${n} ${n === 1 ? "item mudou" : "itens mudaram"} de pilar.`);
      if (pilar && repetidos.some((g) => g.saem.some((s) => s.id === pilar))) setPilar("");
    } catch (e) {
      toast.error(e instanceof Error && /permiss/.test(e.message) ? "Você não tem permissão pra mexer nos pilares desta conta." : "Não deu pra juntar agora. Tenta de novo.");
    }
  };

  const ordenarPor = (c: Coluna) => { if (c === coluna) setDesc((d) => !d); else { setColuna(c); setDesc(true); } };

  const comp = (agora: number | null, antes: number | null | undefined) => {
    const v = ra ? variacao(agora, antes ?? null) : null;
    if (v == null) return null;
    return <span className={cn("text-[11.5px] font-body font-bold", v > 0 ? "text-emerald-700" : v < 0 ? "text-red-600" : "text-muted-foreground")}>{v > 0 ? "+" : ""}{v}% vs antes</span>;
  };

  if (isLoading) return <div className="py-24 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>;

  if (posts.length === 0) {
    return (
      <div className="max-w-4xl pb-20 md:pb-0">
        <div className="bg-card rounded-3xl p-12 border border-border text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5"><Archive className="h-8 w-8 text-primary" /></div>
          <p className="text-lg font-display font-semibold text-foreground mb-2">Seu histórico vai crescer com você</p>
          <p className="text-muted-foreground font-body max-w-sm mx-auto">Quando você publicar seus primeiros conteúdos, eles aparecem aqui com os números de cada um.</p>
          <Link to="/app/criando" className="inline-flex items-center justify-center mt-5 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-body font-semibold">Ir pro quadro de produção</Link>
        </div>
      </div>
    );
  }

  const nomeCrit = CRITERIOS.find((c) => c.key === criterio)!.label.toLowerCase();

  return (
    <div className="max-w-6xl pb-24 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
        <div className="md:hidden">
          <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Histórico</h1>
          <p className="text-muted-foreground font-body mt-0.5 text-sm">O que funcionou e por quê.</p>
        </div>

        {/* FILTROS */}
        <div data-tour="historico-filtros" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PERIODOS.map((o) => (
              <button key={o.key} type="button" onClick={() => { setPeriodo(o.key); setQuantos(20); }}
                className={cn("shrink-0 h-8 px-3 rounded-full text-xs font-body font-bold border transition-colors",
                  periodo === o.key ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{o.label}</button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-end">
            {formatosPresentes.length > 1 && (
              <select aria-label="Formato" value={formato} onChange={(e) => setFormato(e.target.value)} className={sel} style={setinha}>
                <option value="">Formato</option>
                {formatosPresentes.map((f) => <option key={f} value={f}>{formatoDe(f)}</option>)}
              </select>
            )}
            {pillars.length > 0 && (
              <select aria-label="Pilar" value={pilar} onChange={(e) => setPilar(e.target.value)} className={sel} style={setinha}>
                <option value="">Pilar</option>
                {pillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {redesPresentes.length > 1 && (
              <select aria-label="Rede" value={rede} onChange={(e) => setRede(e.target.value)} className={sel} style={setinha}>
                <option value="">Rede</option>
                {redesPresentes.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            )}
            <label className="relative shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar post"
                className="h-8 w-36 sm:w-40 rounded-full border border-border bg-card pl-8 pr-7 text-xs font-body outline-none focus:border-primary" />
              {busca && <button type="button" onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Limpar busca"><X className="h-3.5 w-3.5" /></button>}
            </label>
          </div>
        </div>

        {/* NÚMEROS DO TOPO: resultado, não volume */}
        <div data-tour="historico-stats" className="grid grid-cols-2 lg:grid-cols-5 gap-3 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
          <Numero valor={String(r.posts)} rotulo="Posts publicados"
            extra={ra ? <span className="text-[11.5px] font-body font-bold text-muted-foreground">{r.posts - ra.posts >= 0 ? "+" : ""}{r.posts - ra.posts} vs período anterior</span> : null} />
          <Numero valor={compacto(r.alcanceSoma)} rotulo="Alcance somado" extra={comp(r.alcanceSoma, ra?.alcanceSoma)} />
          <Numero valor={compacto(r.alcanceMedio)} rotulo="Alcance médio por post" extra={comp(r.alcanceMedio, ra?.alcanceMedio)} />
          <Numero valor={compacto(r.salvos)} rotulo="Salvamentos" destaque
            extra={<span className="text-[11.5px] font-body font-semibold text-foreground/80">o melhor sinal de conteúdo útil</span>} />
          <Numero valor={`${r.seguidores > 0 ? "+" : ""}${compacto(r.seguidores)}`} rotulo="Seguidores ganhos pelos posts"
            extra={r.comSeguidores === 0
              ? <span className="text-[11.5px] font-body text-muted-foreground">o Instagram não manda isso pra Reels</span>
              : comp(r.seguidores, ra?.seguidores)} />
        </div>
        {r.posts > 0 && r.comNumeros < r.posts && (
          <p className="-mt-3 text-[12px] font-body text-muted-foreground">
            {r.posts - r.comNumeros} {r.posts - r.comNumeros === 1 ? "post está" : "posts estão"} sem números. Vincule ao Instagram em <Link to="/app/insights" className="underline font-semibold">Insights</Link> ou preencha o resultado no post.
          </p>
        )}

        {atuais.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center">
            <p className="font-display font-bold text-foreground">Nada nesse filtro</p>
            <p className="text-sm font-body text-muted-foreground mt-1">Troque o período ou limpe os filtros.</p>
          </div>
        ) : (
          <>
            {/* O QUE MAIS FUNCIONOU */}
            <section>
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2 mb-3">
                <h2 className="font-display font-extrabold text-lg text-foreground">O que mais funcionou</h2>
                <span className="text-[12px] font-body text-muted-foreground">ranking por {nomeCrit}</span>
                <div className="flex gap-1 sm:ml-auto overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {CRITERIOS.map((c) => (
                    <button key={c.key} type="button" onClick={() => setCriterio(c.key)}
                      className={cn("shrink-0 h-7 px-2.5 rounded-full text-[11.5px] font-body font-bold border",
                        criterio === c.key ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>{c.label}</button>
                  ))}
                </div>
              </div>
              {podio.length === 0 ? (
                <p className="text-sm font-body text-muted-foreground rounded-2xl border border-dashed border-border p-6 text-center">Nenhum post desse período tem número de {nomeCrit} ainda.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 md:grid md:grid-cols-3 md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {podio.map((l, i) => (
                    <article key={l.p.id} className={cn(cartao, "overflow-hidden shrink-0 snap-start w-[82%] md:w-auto", i === 1 && "md:rotate-[0.6deg]", i === 0 && "md:-rotate-[0.4deg]")}>
                      <div className="relative h-32 bg-muted" style={{ background: l.capa ? undefined : COR_FORMATO[l.p.format ?? ""] ?? "#555" }}>
                        {l.capa && <img src={l.capa} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                        <span className={cn("absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full border-2 border-foreground font-display font-extrabold text-sm",
                          i === 0 ? "bg-[#FFCF03]" : i === 1 ? "bg-[#E5E7EB]" : "bg-[#F2B886]")}>{i + 1}</span>
                        <span className="absolute right-3 top-3 rounded-full bg-white px-2 py-0.5 text-[10px] font-body font-extrabold uppercase tracking-wide text-foreground">{formatoDe(l.p.format)}</span>
                      </div>
                      <div className="p-3.5">
                        <p className="font-display font-bold text-[15px] leading-tight line-clamp-1 text-foreground">{l.p.title || "Sem título"}</p>
                        <p className="text-[11.5px] font-body text-muted-foreground mt-0.5 truncate">
                          {[l.p.pillar_id ? nomePilar[l.p.pillar_id] : null, l.p.published_at ? faixaDoHorario(l.p.published_at).toLowerCase() : null].filter(Boolean).join(" · ")}
                        </p>
                        <div className="grid grid-cols-4 gap-1 mt-3 text-center">
                          {(l.p.format === "reels" && (l.n.tempoMedio != null || l.n.pularam != null)
                            ? [["alcance", compacto(l.n.alcance)], ["tempo médio", l.n.tempoMedio != null ? `${l.n.tempoMedio.toLocaleString("pt-BR")} s` : "-"], ["pularam", l.n.pularam != null ? `${Math.round(l.n.pularam)}%` : "-"], ["compart.", compacto(l.n.compart)]]
                            : [["alcance", compacto(l.n.alcance)], ["salvos", compacto(l.n.salvos)], ["compart.", compacto(l.n.compart)], ["seguid.", l.n.seguidores != null ? `+${l.n.seguidores}` : "-"]]
                          ).map(([rot, val]) => (
                            <div key={rot}><p className="font-display font-extrabold text-[15px] tabular-nums text-foreground">{val}</p><p className="text-[10px] font-body text-muted-foreground">{rot}</p></div>
                          ))}
                        </div>
                        <p className="mt-2.5 font-display italic font-bold text-[13px] text-[#EB4918]">{porque(l, criterio, atuais)}</p>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          <button type="button" onClick={() => setReaproveitar(l.p)} className="inline-flex items-center gap-1 rounded-full bg-foreground text-background px-3 h-8 text-xs font-body font-bold"><Repeat2 className="h-3.5 w-3.5" /> Reaproveitar</button>
                          {l.link && <a href={l.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-foreground px-3 h-8 text-xs font-body font-bold text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Ver no Instagram</a>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* ONDE ESTÁ O RESULTADO */}
            {(grupos.formato.length > 0 || grupos.pilar.length > 0 || grupos.horario.length > 0) && (
              <section>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-3">
                  <h2 className="font-display font-extrabold text-lg text-foreground">Onde está o seu resultado</h2>
                  <span className="text-[12px] font-body text-muted-foreground">alcance médio por post</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Barras titulo="Por formato" cor="#EB4918" grupos={grupos.formato} />
                  <Barras titulo="Por pilar" cor="#FF77B9" grupos={grupos.pilar} />
                  <Barras titulo="Por dia e horário" cor="#FFCF03" grupos={grupos.horario} />
                </div>
              </section>
            )}

            {/* MÊS A MÊS */}
            {meses.length > 1 && (
              <section>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-3">
                  <h2 className="font-display font-extrabold text-lg text-foreground">Mês a mês</h2>
                  <span className="text-[12px] font-body text-muted-foreground">posts (barra) e alcance médio (linha)</span>
                </div>
                <div className={cn(cartao, "p-3 sm:p-4 h-56")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={meses} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="p" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={34} />
                      <YAxis yAxisId="a" orientation="right" hide />
                      <Tooltip
                        formatter={(v: number, k: string) => [k === "posts" ? `${v} ${v === 1 ? "post" : "posts"}` : `${compacto(v)} de alcance médio`, ""]}
                        labelFormatter={(_l, p) => (p?.[0]?.payload as { nome?: string } | undefined)?.nome ?? ""}
                        separator="" contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                      <Bar yAxisId="p" dataKey="posts" fill="#EB4918" stroke="hsl(var(--foreground))" strokeWidth={1.5} radius={[4, 4, 0, 0]} maxBarSize={44} />
                      <Line yAxisId="a" dataKey="alcance" type="monotone" stroke="#0061EE" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* TODOS OS POSTS */}
            <section>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-3">
                <h2 className="font-display font-extrabold text-lg text-foreground">Todos os posts</h2>
                <span className="text-[12px] font-body text-muted-foreground">{atuais.length} no período · ordene por qualquer coluna</span>
              </div>

              {/* Computador: tabela */}
              <div className={cn(cartao, "hidden md:block overflow-hidden")}>
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="border-b-2 border-foreground text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      <Th onClick={() => ordenarPor("data")} ativo={coluna === "data"} desc={desc} className="text-left pl-4">Post</Th>
                      <Th onClick={() => ordenarPor("alcance")} ativo={coluna === "alcance"} desc={desc}>Alcance</Th>
                      <Th onClick={() => ordenarPor("salvos")} ativo={coluna === "salvos"} desc={desc}>Salvos</Th>
                      <Th onClick={() => ordenarPor("compart")} ativo={coluna === "compart"} desc={desc}>Compart.</Th>
                      <Th onClick={() => ordenarPor("curtidas")} ativo={coluna === "curtidas"} desc={desc}>Curtidas</Th>
                      <Th onClick={() => ordenarPor("coment")} ativo={coluna === "coment"} desc={desc}>Coment.</Th>
                      <Th onClick={() => ordenarPor("seguidores")} ativo={coluna === "seguidores"} desc={desc}>Seguid.</Th>
                      <th className="w-[210px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {ordenadas.slice(0, quantos).map((l) => {
                      const maxAlc = Math.max(1, ...atuais.map((x) => x.n.alcance ?? 0));
                      return (
                        <tr key={l.p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="py-2.5 pl-4 pr-2 max-w-[280px]">
                            <div className="flex items-center gap-2">
                              <PlatformIcon platform={l.p.platform ?? "instagram"} size="sm" className="shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground truncate">{l.p.title || "Sem título"}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {[formatoDe(l.p.format), l.p.pillar_id ? nomePilar[l.p.pillar_id] : null, dataCurta(l.p.published_at)].filter(Boolean).join(" · ")}
                                  {!temNumeros(l.n) && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-px text-[10px] font-bold">sem dados</span>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 text-right tabular-nums">
                            <div className="flex items-center justify-end gap-2">
                              {compacto(l.n.alcance)}
                              <span className="hidden lg:block h-1.5 w-12 rounded-full bg-muted overflow-hidden"><span className="block h-full bg-emerald-600" style={{ width: `${((l.n.alcance ?? 0) / maxAlc) * 100}%` }} /></span>
                            </div>
                          </td>
                          <td className="px-2 text-right tabular-nums">{compacto(l.n.salvos)}</td>
                          <td className="px-2 text-right tabular-nums">{compacto(l.n.compart)}</td>
                          <td className="px-2 text-right tabular-nums">{compacto(l.n.curtidas)}</td>
                          <td className="px-2 text-right tabular-nums">{compacto(l.n.coment)}</td>
                          <td className="px-2 text-right tabular-nums">{l.n.seguidores != null ? `+${l.n.seguidores}` : "-"}</td>
                          <td className="pr-3 text-right whitespace-nowrap">
                            {l.link && <a href={l.link} target="_blank" rel="noreferrer" title="Ver no Instagram" className="inline-grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground align-middle"><ExternalLink className="h-3.5 w-3.5" /></a>}
                            <button type="button" onClick={() => setReaproveitar(l.p)} className="ml-1 inline-flex items-center gap-1 rounded-full border border-foreground px-3 h-8 text-xs font-bold text-foreground align-middle"><Repeat2 className="h-3.5 w-3.5" /> Reaproveitar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Celular: cartões com ordenação num seletor */}
              <div className="md:hidden">
                <select aria-label="Ordenar por" value={`${coluna}:${desc ? "d" : "a"}`}
                  onChange={(e) => { const [c, d] = e.target.value.split(":"); setColuna(c as Coluna); setDesc(d === "d"); }}
                  className={cn(sel, "mb-2 max-w-none")} style={setinha}>
                  <option value="data:d">Mais recentes</option>
                  <option value="data:a">Mais antigos</option>
                  <option value="alcance:d">Mais alcance</option>
                  <option value="salvos:d">Mais salvos</option>
                  <option value="compart:d">Mais compartilhados</option>
                  <option value="seguidores:d">Mais seguidores</option>
                </select>
                <div className="space-y-2">
                  {ordenadas.slice(0, quantos).map((l) => (
                    <div key={l.p.id} className="rounded-2xl border-2 border-foreground bg-card p-3">
                      <div className="flex items-start gap-2">
                        <PlatformIcon platform={l.p.platform ?? "instagram"} size="sm" className="mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-body font-bold text-sm text-foreground line-clamp-2">{l.p.title || "Sem título"}</p>
                          <p className="text-[11.5px] font-body text-muted-foreground">{formatoDe(l.p.format)} · {dataCurta(l.p.published_at)}</p>
                        </div>
                      </div>
                      {temNumeros(l.n) ? (
                        <p className="mt-2 text-[12px] font-body text-foreground/85 tabular-nums">
                          <b>{compacto(l.n.alcance)}</b> alcance · <b>{compacto(l.n.salvos)}</b> salvos · <b>{compacto(l.n.compart)}</b> compart.{l.n.seguidores != null ? <> · <b>+{l.n.seguidores}</b> seguid.</> : null}
                        </p>
                      ) : <p className="mt-2 text-[11.5px] font-body text-muted-foreground">sem dados ainda</p>}
                      <div className="flex gap-1.5 mt-2.5">
                        <button type="button" onClick={() => setReaproveitar(l.p)} className="inline-flex items-center gap-1 rounded-full bg-foreground text-background px-3 h-8 text-xs font-body font-bold"><Repeat2 className="h-3.5 w-3.5" /> Reaproveitar</button>
                        {l.link && <a href={l.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-foreground px-3 h-8 text-xs font-body font-bold text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Instagram</a>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {ordenadas.length > quantos && (
                <button type="button" onClick={() => setQuantos((q) => q + 20)} className="mt-3 w-full h-10 rounded-full border border-border bg-card text-sm font-body font-bold text-foreground">
                  Ver mais {Math.min(20, ordenadas.length - quantos)} de {ordenadas.length - quantos}
                </button>
              )}
            </section>
          </>
        )}

        {/* PILARES REPETIDOS */}
        {repetidos.length > 0 && podeJuntar && (
          <div className="rounded-[20px] border-2 border-foreground bg-[#FFCF03] p-4 shadow-[0_4px_0_hsl(var(--foreground))] flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-display font-extrabold text-foreground">Seus pilares estão repetidos.</p>
              <p className="text-[13px] font-body text-foreground/85 mt-0.5">
                {repetidos.map((g) => [g.fica, ...g.saem].map((p) => `"${p.name}"`).join(" e ")).join("; ")}. Isso divide os números no meio.
              </p>
            </div>
            <button type="button" onClick={() => void juntarAgora()} disabled={juntar.isPending}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground text-background px-4 h-10 text-sm font-body font-bold disabled:opacity-60">
              {juntar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Juntar os repetidos
            </button>
          </div>
        )}
      </motion.div>

      {reaproveitar && (
        <RepurposeSheet open={!!reaproveitar} onOpenChange={(o) => { if (!o) setReaproveitar(null); }} originalPost={reaproveitar} />
      )}
    </div>
  );
};

function Numero({ valor, rotulo, extra, destaque }: { valor: string; rotulo: string; extra?: ReactNode; destaque?: boolean }) {
  return (
    <div className={cn(cartao, "p-3.5 sm:p-4 min-w-0", destaque && "bg-[#FFCF03]")}>
      <p className="font-display font-extrabold text-2xl sm:text-[28px] leading-none tabular-nums text-foreground">{valor}</p>
      <p className="text-[12px] font-body text-foreground/75 mt-1.5 leading-tight">{rotulo}</p>
      {extra && <div className="mt-1 leading-tight">{extra}</div>}
    </div>
  );
}

function Barras({ titulo, cor, grupos }: { titulo: string; cor: string; grupos: { chave: string; nome: string; alcanceMedio: number; posts: number }[] }) {
  const max = Math.max(1, ...grupos.map((g) => g.alcanceMedio));
  return (
    <div className={cn(cartao, "p-4")}>
      <p className="font-display font-extrabold text-[15px] text-foreground mb-3">{titulo}</p>
      {grupos.length === 0 ? <p className="text-[12.5px] font-body text-muted-foreground">Sem alcance registrado ainda.</p> : (
        <div className="space-y-2.5">
          {grupos.map((g) => (
            <div key={g.chave} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2">
              <span className="text-[12.5px] font-body text-foreground truncate" title={`${g.nome} · ${g.posts} ${g.posts === 1 ? "post" : "posts"}`}>{g.nome}</span>
              <span className="h-3 rounded-full border border-foreground/80 overflow-hidden bg-background"><span className="block h-full" style={{ width: `${(g.alcanceMedio / max) * 100}%`, background: cor }} /></span>
              <span className="text-[12.5px] font-display font-extrabold tabular-nums text-foreground">{compacto(g.alcanceMedio)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Th({ children, onClick, ativo, desc, className }: { children: ReactNode; onClick: () => void; ativo: boolean; desc: boolean; className?: string }) {
  return (
    <th className={cn("py-2.5 px-2 text-right font-bold", className)}>
      <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-0.5 uppercase tracking-wider", ativo && "text-foreground")}>
        {children}{ativo && (desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </th>
  );
}

export default Historico;

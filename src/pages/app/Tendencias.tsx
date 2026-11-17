import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Loader2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCriaAI } from "@/contexts/CriaAIContext";
import { useProfile } from "@/hooks/useProfile";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { CrIA } from "@/components/brand/CrIA";
import { Chip } from "@/components/tendencias/TrendPickerDialog";
import {
  useTendencias, useTendenciasMaisUsadas, serveProNicho, registrarUsoTendencias,
  NOME_TIPO_TENDENCIA, COR_TIPO_TENDENCIA, type Tendencia, type TipoTendencia,
} from "@/hooks/useTendencias";
import { proximasDatas, dataCurta } from "@/lib/datasComerciais";
import { NOME_TIPO, tipoDoFormato, type TipoStory } from "@/lib/storyRoteiro";

/* ═══════════════════════════════════════════════════════════════════════════
   TENDÊNCIAS (28/10/2026, mockup aprovado, aba 3)

   Três destaques em cima (mais usada no Cria, próxima data, gancho em alta),
   faixa de datas que vêm aí, filtros por tipo + "pro seu nicho" + "só
   stories", e marcar várias pra levar de uma vez: ideias com a CrIA, montar
   stories ou levar pro Cria Plano. Os dois bancos (posts e stories) juntos.

   17/11/2026 (Walter, mockup aprovado): os stories saíram do meio dos posts.
   Agora são duas abas, "Pra posts" e "Pra stories". Na de stories o cartão é
   próprio: tipo do story, como fazer, por que agora e dois caminhos diretos,
   "Criar este story" (abre o Novo story com a tendência) e "Marcar pra semana"
   (vai pro Montar a semana com a CrIA). Antes era um chip "Só stories" no fim
   dos filtros e o cartão de story tinha os mesmos botões do de post.
   ═══════════════════════════════════════════════════════════════════════════ */

type Filtro = "todas" | "formato" | "tema" | "gancho" | "data";
const FILTROS: Array<[Filtro, string]> = [["todas", "Todas"], ["formato", "Formatos"], ["tema", "Temas"], ["gancho", "Ganchos"], ["data", "Datas"]];

type Aba = "posts" | "stories";

/** Selo do cartão de story por tipo (as mesmas cores do Cria Stories). */
const COR_TIPO_STORY: Record<TipoStory, string> = {
  falado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  figurinha: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  midia: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  texto: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
};

const NOME_FORMATO: Record<string, string> = {
  enquete: "Enquete", caixinha: "Caixinha", quiz: "Quiz", contagem: "Contagem", bastidor: "Bastidor",
  tutorial: "Tutorial", "antes-depois": "Antes e depois", trend: "Áudio em alta", "dica-rapida": "Dica rápida",
};
function nomeFormato(f: string | null): string {
  if (!f) return "";
  const k = f.toLowerCase().trim();
  if (NOME_FORMATO[k]) return NOME_FORMATO[k];
  const t = k.replace(/[-_]+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/** Quantos stories a tendência rende, quando o exemplo numera ("Story 1", "Story 2"...). */
function quantosStories(exemplo: string | null): number {
  const ns = [...(exemplo ?? "").matchAll(/story\s*(\d)/gi)].map((m) => Number(m[1]));
  return ns.length ? Math.max(...ns) : 1;
}

export default function Tendencias() {
  const { profile } = useProfile();
  const { profile: conta } = useActiveProfile();
  const { openCria } = useCriaAI();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "admin";
  const { data: todas, isLoading } = useTendencias();
  const { data: ranking = [] } = useTendenciasMaisUsadas(7);

  const [aba, setAba] = useState<Aba>("posts");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [tipoStory, setTipoStory] = useState<TipoStory | "todos">("todos");
  const [soNicho, setSoNicho] = useState(true);
  const [marcadas, setMarcadas] = useState<string[]>([]);

  const datas = useMemo(() => proximasDatas(new Date(), 5), []);
  const ultima = useMemo(() => todas.reduce<string | null>((m, t) => (!m || t.criadaEm > m ? t.criadaEm : m), null), [todas]);

  const doNicho = useMemo(() => todas.filter((t) => !soNicho || serveProNicho(t, conta?.niche)), [todas, soNicho, conta?.niche]);
  const posts = useMemo(() => doNicho.filter((t) => t.fonte !== "story"), [doNicho]);
  const stories = useMemo(() => doNicho.filter((t) => t.fonte === "story"), [doNicho]);
  const postsVisiveis = useMemo(() => posts.filter((t) => filtro === "todas" || t.tipo === filtro), [posts, filtro]);
  const tiposComStory = useMemo(() => (["figurinha", "falado", "midia", "texto"] as TipoStory[]).filter((tp) => stories.some((t) => tipoDoFormato(t.formatoStory) === tp)), [stories]);
  const storiesVisiveis = useMemo(() => stories.filter((t) => tipoStory === "todos" || tipoDoFormato(t.formatoStory) === tipoStory), [stories, tipoStory]);

  /* Destaques (aba de posts). "Mais usada" vem do registro de uso (trend_usos);
     sem uso na semana, mostra o formato mais novo da curadoria com outro selo. */
  const maisUsada = useMemo(() => {
    for (const r of ranking) {
      const t = todas.find((x) => x.fonte === r.fonte && x.id === r.trend_id && x.fonte !== "story");
      if (t) return { t, selo: "Mais usada no Cria esta semana" };
    }
    const t = todas.find((x) => x.tipo === "formato");
    return t ? { t, selo: "Formato em alta" } : null;
  }, [ranking, todas]);
  const gancho = useMemo(() => todas.find((x) => x.tipo === "gancho") ?? null, [todas]);
  const proxima = datas[0];

  /* A barra de baixo só conta o que está marcado na aba aberta. */
  const sel = todas.filter((t) => marcadas.includes(t.chave) && (aba === "stories" ? t.fonte === "story" : t.fonte !== "story"));
  const alternar = (c: string) => setMarcadas((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));
  const limpar = () => setMarcadas((l) => l.filter((c) => !sel.some((t) => t.chave === c)));

  const ideiaCom = (lista: Tendencia[]) => {
    if (!lista.length) return;
    registrarUsoTendencias(lista, "tendencias-ideia");
    const nomes = lista.map((t) => `"${t.titulo}"${t.descricao ? ` (${t.descricao})` : ""}`).join("; ");
    openCria(`Quero ideias de conteúdo pra minha marca usando ${lista.length > 1 ? "estas tendências" : "esta tendência"}: ${nomes}. Me dá 3 ideias prontas (gancho + formato), no meu tom e nicho, com uma legenda curta em cada.`);
  };
  const levar = (para: "/app/stories" | "/app/autopilot") => {
    navigate(para, { state: { tendencias: sel.map((t) => t.chave) } });
  };
  const criarStory = (t: Tendencia) => {
    registrarUsoTendencias([t], "tendencias-criar-story");
    navigate("/app/stories", { state: { novoStoryBase: { chave: t.chave, titulo: t.titulo, exemplo: t.exemplo, formato: t.formatoStory } } });
  };

  const abaBtn = (k: Aba, rotulo: string, n: number) => (
    <button type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
      className={cn("flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-body font-bold transition-colors",
        aba === k ? "bg-foreground text-background" : "text-foreground hover:bg-muted")}>
      {rotulo}
      <span className={cn("text-[11px] rounded-full px-1.5 py-px tabular-nums", aba === k ? "bg-background/20" : "bg-muted")}>{n}</span>
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-pink-400 flex items-center justify-center shadow-sm shrink-0">
            <TrendingUp className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Tendências</h1>
            <p className="text-muted-foreground font-body text-sm mt-0.5">
              Curadoria do Cria · atualizada toda segunda{ultima ? ` · última em ${new Date(ultima).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}
            </p>
          </div>
        </div>
        <div role="tablist" aria-label="Tipo de tendência" className="w-full sm:w-auto flex rounded-full border-[1.5px] border-foreground bg-card p-1 gap-1">
          {abaBtn("posts", "Pra posts", posts.length)}
          {abaBtn("stories", "Pra stories", stories.length)}
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center"><Loader2 className="h-6 w-6 text-primary mx-auto animate-spin" /></div>
      ) : todas.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl py-16 px-6 text-center">
          <TrendingUp className="h-7 w-7 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-body text-foreground font-medium">Banco de tendências ainda não atualizado</p>
          <p className="text-xs font-body text-muted-foreground mt-1">{isAdmin ? "Gere a primeira leva pelo Painel Admin → Banco de Tendências." : "Em breve a curadoria do CRIA traz as novidades aqui."}</p>
        </div>
      ) : aba === "posts" ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5" data-tour="tend-plano">
            {FILTROS.map(([k, r]) => <Chip key={k} on={filtro === k} onClick={() => setFiltro(k)}>{r}</Chip>)}
            <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
            <Chip on={soNicho} onClick={() => setSoNicho((v) => !v)}>Pro seu nicho</Chip>
          </div>

          <div className="grid gap-2.5 md:grid-cols-3">
            {maisUsada && <Destaque selo={maisUsada.selo} seloCls="bg-primary" titulo={maisUsada.t.titulo} texto={maisUsada.t.exemplo || maisUsada.t.descricao} />}
            {proxima && <Destaque selo="Próxima data" seloCls="bg-pink-600" titulo={`${proxima.nome} · ${dataCurta(proxima.iso)}`}
              texto={`${proxima.diasAte === 0 ? "É hoje." : proxima.diasAte === 1 ? "Falta 1 dia." : `Faltam ${proxima.diasAte} dias.`} ${proxima.dica}.`} />}
            {gancho && <Destaque selo="Gancho em alta" seloCls="bg-emerald-700" titulo={`“${gancho.titulo}”`} texto={gancho.descricao} />}
          </div>

          <section>
            <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-2">Datas que vêm aí</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {datas.map((d) => (
                <div key={d.iso} className="min-w-[150px] rounded-2xl bg-card border border-border p-3 flex flex-col gap-0.5">
                  <b className="font-display font-extrabold text-xl">{dataCurta(d.iso)}</b>
                  <span className="text-xs font-body text-muted-foreground"><b className="text-foreground">{d.nome}</b> · {d.dica}</span>
                </div>
              ))}
            </div>
          </section>

          <div data-tour="tend-lista" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {postsVisiveis.map((t) => {
              const on = marcadas.includes(t.chave);
              return (
                <div key={t.chave} className={cn("bg-card rounded-[18px] p-3.5 flex flex-col gap-2 border-[1.5px]", on ? "border-primary" : "border-transparent")}>
                  <span className={cn("self-start text-[11px] font-body font-bold rounded-full px-2.5 py-0.5", COR_TIPO_TENDENCIA[t.tipo as TipoTendencia])}>
                    {NOME_TIPO_TENDENCIA[t.tipo]}
                  </span>
                  <h3 className="font-display font-semibold text-[15px] leading-snug text-foreground">{t.titulo}</h3>
                  {t.descricao && <p className="text-[12.8px] font-body text-muted-foreground leading-relaxed">{t.descricao}</p>}
                  {t.exemplo && <p className="text-[12.5px] font-body text-foreground bg-primary/[0.06] rounded-lg px-2.5 py-2"><b className="text-primary">Exemplo:</b> {t.exemplo}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-border">
                    <Button size="sm" variant={on ? "default" : "outline"} className="rounded-full h-8" onClick={() => alternar(t.chave)}>
                      {on ? <><Check className="h-3.5 w-3.5" /> Marcada</> : "Marcar"}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => ideiaCom([t])}>
                      <span aria-hidden>✦</span> Ideia com a <CrIA />
                    </Button>
                  </div>
                </div>
              );
            })}
            {postsVisiveis.length === 0 && <p className="text-sm font-body text-muted-foreground col-span-full py-6 text-center">Nada nesse filtro agora.</p>}
          </div>

          {sel.length > 0 && (
            <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+84px)] md:bottom-3 z-20 rounded-[18px] bg-foreground text-background px-3.5 py-3 flex flex-wrap items-center gap-2 shadow-xl">
              <span className="flex-1 min-w-[150px] text-[13px] font-body">{sel.length} tendência{sel.length > 1 ? "s" : ""} marcada{sel.length > 1 ? "s" : ""}</span>
              <Button size="sm" variant="secondary" className="rounded-full h-8 bg-white/10 text-background hover:bg-white/20" onClick={() => ideiaCom(sel)}><span aria-hidden>✦</span> Ideias de post com a <CrIA /></Button>
              <Button size="sm" variant="secondary" className="rounded-full h-8 bg-white/10 text-background hover:bg-white/20" onClick={() => levar("/app/stories")}>Montar stories com elas</Button>
              <Button size="sm" className="rounded-full h-8" onClick={() => levar("/app/autopilot")}>Levar pro Cria Plano</Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="rounded-[18px] bg-card border border-border px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 max-w-[640px]">
              <h2 className="font-display font-bold text-[16px] text-foreground">Formatos de story em alta nesta semana</h2>
              <p className="text-[13px] font-body text-muted-foreground leading-relaxed mt-0.5">
                Cada cartão já vem com o jeito de fazer. Toque em “Criar este story” pra abrir um pronto pra adaptar, ou marque vários e monte a semana inteira com a <CrIA />.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" data-tour="tend-plano">
              <Chip on={tipoStory === "todos"} onClick={() => setTipoStory("todos")}>Todos</Chip>
              {tiposComStory.map((tp) => <Chip key={tp} on={tipoStory === tp} onClick={() => setTipoStory(tp)}>{NOME_TIPO[tp]}</Chip>)}
            </div>
          </div>

          <div data-tour="tend-lista" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {storiesVisiveis.map((t) => {
              const on = marcadas.includes(t.chave);
              const tp = tipoDoFormato(t.formatoStory);
              const fmt = nomeFormato(t.formatoStory);
              const n = quantosStories(t.exemplo);
              return (
                <div key={t.chave} className={cn("bg-card rounded-[18px] p-3.5 flex flex-col gap-2 border-[1.5px]", on ? "border-primary" : "border-transparent")}>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={cn("text-[11px] font-body font-bold rounded-full px-2.5 py-0.5", COR_TIPO_STORY[tp])}>{NOME_TIPO[tp]}{fmt ? ` · ${fmt}` : ""}</span>
                    {n > 1 && <span className="text-[11px] font-body rounded-full px-2.5 py-0.5 bg-muted text-muted-foreground">{n} stories</span>}
                  </div>
                  <h3 className="font-display font-bold text-[16.5px] leading-snug text-foreground">{t.titulo}</h3>
                  {t.descricao && <p className="text-[12.8px] font-body text-muted-foreground leading-relaxed">{t.descricao}</p>}
                  {t.exemplo && (
                    <div className="text-[12.5px] font-body text-foreground bg-primary/[0.06] rounded-xl px-2.5 py-2 leading-relaxed">
                      <b className="block text-[10.5px] uppercase tracking-wider text-primary mb-0.5">Como fazer</b>{t.exemplo}
                    </div>
                  )}
                  {t.porque && <p className="text-[12px] font-body text-muted-foreground leading-relaxed"><b className="text-foreground">Por que agora:</b> {t.porque}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-auto pt-2.5 border-t border-border">
                    <Button size="sm" className="rounded-full h-9" onClick={() => criarStory(t)}>Criar este story</Button>
                    <Button size="sm" variant="outline" className={cn("rounded-full h-9", on && "border-primary text-primary")} onClick={() => alternar(t.chave)}>
                      {on ? <><Check className="h-3.5 w-3.5" /> Marcada pra semana</> : "Marcar pra semana"}
                    </Button>
                  </div>
                </div>
              );
            })}
            {storiesVisiveis.length === 0 && <p className="text-sm font-body text-muted-foreground col-span-full py-6 text-center">Nenhum formato de story nesse filtro agora.</p>}
          </div>

          {sel.length > 0 && (
            <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+84px)] md:bottom-3 z-20 rounded-[18px] bg-foreground text-background px-3.5 py-3 flex flex-wrap items-center gap-2 shadow-xl">
              <span className="flex-1 min-w-[150px] text-[13px] font-body">{sel.length} formato{sel.length > 1 ? "s" : ""} marcado{sel.length > 1 ? "s" : ""} pra semana</span>
              <Button size="sm" variant="secondary" className="rounded-full h-9 bg-white/10 text-background hover:bg-white/20" onClick={limpar}>Limpar</Button>
              <Button size="sm" className="rounded-full h-9" onClick={() => { registrarUsoTendencias(sel, "tendencias-montar-semana"); levar("/app/stories"); }}>
                <span aria-hidden>✦</span> Montar a semana com a <CrIA sobreLaranja />
              </Button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function Destaque({ selo, seloCls, titulo, texto }: { selo: string; seloCls: string; titulo: string; texto?: string | null }) {
  return (
    <div className="rounded-[18px] bg-foreground text-background p-4 flex flex-col gap-2">
      <span className={cn("self-start text-[11px] font-body font-bold rounded-full px-2.5 py-0.5 text-white", seloCls)}>{selo}</span>
      <b className="font-display font-semibold text-[17px] leading-snug">{titulo}</b>
      {texto && <p className="text-[13px] font-body opacity-85 leading-relaxed">{texto}</p>}
    </div>
  );
}

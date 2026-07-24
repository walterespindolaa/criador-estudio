import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Sparkles, Check, X, Trash2, Instagram, Heart, MessageCircle, Play, CalendarPlus,
  LayoutGrid, FileText, CircleDashed, User, AtSign, Hash, Megaphone, TrendingUp, Plus, ChevronDown, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useScrapes, useCreativeIdeas, useRunScrape, useUpdateIdeaStatus, useDeleteIdea, useDeleteScrape, useGeneratePlanFromIdeas,
  useHubCredits, CREDITOS_POR_TIPO,
  useCompetitors, useAddCompetitor, useDeleteCompetitor, diasSemLeitura,
  type ScrapeType, type CreativeIdea,
} from "@/hooks/useHubCria";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";
import { CRIA_HEX } from "@/lib/moduleTheme";
import { useExternalClients } from "@/hooks/useCriaPost";
import { supabase } from "@/integrations/supabase/client";
import { confirmar } from "@/components/shared/Confirm";

type InputKind = "handle" | "url" | "hashtag";
type TypeDef = { key: ScrapeType; label: string; icon: typeof LayoutGrid; desc: string; inputKind: InputKind; cost?: string };

// ═══════════════════════════════════════════════════════════════════════════
// AS ANÁLISES
//
// STORIES FOI REMOVIDO. Ele nunca poderia funcionar: o scraper do Instagram não
// enxerga stories sem uma sessão logada, e não há cookies configurados. Era um
// botão que só sabia falhar — e botão que falha destrói a confiança no módulo
// inteiro. Volta quando existir sessão.
//
// Os grupos agora seguem a INTENÇÃO da pessoa, não o tipo técnico do dado:
// "o que ele posta" (copiar o formato), "o que o público quer" (achar pauta),
// "onde ele aposta dinheiro" (a estratégia).
// ═══════════════════════════════════════════════════════════════════════════
const GROUPS: { group: string; hint: string; items: TypeDef[] }[] = [
  {
    group: "O que ele posta",
    hint: "Pra você entender o formato e o gancho que funcionam no nicho.",
    items: [
      { key: "posts", label: "Posts do feed", icon: LayoutGrid, desc: "Os que mais engajaram: legenda, curtidas, formato. A base das ideias.", inputKind: "handle" },
      { key: "reels", label: "Reels", icon: Play, desc: "Os reels dele, com views e o que performou.", inputKind: "handle" },
      { key: "transcription", label: "Reels + roteiro", icon: FileText, desc: "Transcreve o áudio: você LÊ o roteiro do reel que bombou. Aceita o @ ou o link do reel.", inputKind: "handle", cost: "o mais caro" },
    ],
  },
  {
    group: "O que o público quer",
    hint: "Pra tirar pauta da boca de quem compra, não do seu achismo.",
    items: [
      { key: "comments", label: "Comentários", icon: MessageCircle, desc: "As dúvidas e objeções do público num post viram pauta. Precisa da URL do post.", inputKind: "url" },
      { key: "hashtag", label: "Hashtag", icon: Hash, desc: "O que está bombando numa hashtag do nicho.", inputKind: "hashtag" },
      { key: "mentions", label: "Menções / UGC", icon: AtSign, desc: "Quem marca o @: UGC, parceiros e oportunidades.", inputKind: "handle" },
    ],
  },
  {
    group: "Onde ele aposta dinheiro",
    hint: "O que o concorrente PAGA pra promover é o que ele já testou e sabe que converte.",
    items: [
      { key: "ads", label: "Anúncios (Meta)", icon: Megaphone, desc: "Os anúncios ATIVOS da página dele: a oferta, o ângulo e o CTA.", inputKind: "handle", cost: "custa 2" },
      { key: "profile", label: "Perfil (raio-x)", icon: User, desc: "Seguidores, bio, categoria e link. Só panorama, não gera pauta.", inputKind: "handle" },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);

const STATUS_META: Record<CreativeIdea["status"], { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-muted text-muted-foreground" },
  usar: { label: "Usar", cls: "bg-primary/10 text-primary" },
  usada: { label: "Usada", cls: "bg-secondary/15 text-secondary" },
  descartada: { label: "Descartada", cls: "bg-destructive/10 text-destructive" },
};
const STATUS_FILTERS = ["todas", "novo", "usar", "usada", "descartada"] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   OS FILTROS DO HISTÓRICO

   Por INTENÇÃO, não pelo nome técnico do scraper. "transcription" e "ads" não
   dizem nada pra quem usa; "roteiros" e "mercado" dizem.

   E o filtro "virou post" existe por um motivo comercial: é o que a social mídia
   abre pra mostrar pro cliente, na renovação do contrato, que a pesquisa que ela
   cobra virou entrega.
   ═══════════════════════════════════════════════════════════════════════════ */
type FiltroHist = "tudo" | "conteudo" | "roteiro" | "mercado" | "virou";

const FILTROS: { key: FiltroHist; label: string }[] = [
  { key: "tudo", label: "Tudo" },
  { key: "conteudo", label: "Conteúdo" },
  { key: "roteiro", label: "Roteiros" },
  { key: "mercado", label: "Mercado" },
  { key: "virou", label: "Virou post" },
];

const GRUPO_DO_TIPO: Record<string, Exclude<FiltroHist, "tudo" | "virou">> = {
  posts: "conteudo", reels: "conteudo", profile: "conteudo",
  transcription: "roteiro",
  ads: "mercado", comments: "mercado", hashtag: "mercado", mentions: "mercado",
};

function casaFiltro(
  s: { id: string; scrape_type: string },
  f: FiltroHist,
  porScrape: Record<string, CreativeIdea[]>,
): boolean {
  if (f === "tudo") return true;
  if (f === "virou") return (porScrape[s.id] || []).some((i) => i.status === "usada");
  return GRUPO_DO_TIPO[s.scrape_type] === f;
}

/** Cor da faixa lateral: a pessoa aprende a cor e reconhece o tipo sem ler. */
const COR_DO_TIPO: Record<string, string> = {
  posts: CRIA_HEX.laranja, reels: CRIA_HEX.laranja, profile: "#D9D5CC",
  transcription: CRIA_HEX.lilas,
  ads: CRIA_HEX.verde, comments: CRIA_HEX.azul, hashtag: CRIA_HEX.azul, mentions: CRIA_HEX.azul,
};

function haQuanto(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  const m = Math.floor(d / 30);
  return m === 1 ? "há 1 mês" : `há ${m} meses`;
}

export function CriativoTab({ clientId }: { clientId?: string; clientName?: string }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({ posts: true });
  const [handle, setHandle] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [reelLinks, setReelLinks] = useState<string[]>([""]);
  const [tag, setTag] = useState("");
  const [limit, setLimit] = useState(10);
  const [since, setSince] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("todas");

  const { data: scrapes = [] } = useScrapes(clientId);
  const { data: ideas = [] } = useCreativeIdeas(clientId);
  const run = useRunScrape();
  const upd = useUpdateIdeaStatus();
  const del = useDeleteIdea();
  const delScrape = useDeleteScrape();
  const genPlan = useGeneratePlanFromIdeas();
  const { clients: extClients } = useExternalClients();
  const extClient = clientId ? extClients.find((c: { crm_client_id?: string | null }) => c.crm_client_id === clientId) : null;
  const usarCount = ideas.filter((i) => i.status === "usar").length;

  const selectedItems = ALL.filter((i) => selected[i.key]);
  const hasTranscription = selectedItems.some((i) => i.key === "transcription");
  const validLinks = reelLinks.map((l) => l.trim()).filter(Boolean);
  const hasLinks = validLinks.length > 0;
  // Transcrição aceita @ OU link; só exige o @ quando NÃO tem link e há outro item que precise do @.
  const needHandle = selectedItems.some((i) => i.inputKind === "handle" && !(i.key === "transcription" && hasLinks));
  const needUrl = selectedItems.some((i) => i.inputKind === "url");
  const needTag = selectedItems.some((i) => i.inputKind === "hashtag");
  // Período (desde a data) não faz sentido p/ perfil, comentários, stories e anúncios (Meta não filtra por data assim).
  const noPeriod = selectedItems.every((i) => ["profile", "comments", "stories", "ads"].includes(i.key));
  // "Quantos posts" só serve pros itens que puxam N recentes; transcrição por link não usa (a qtd é o nº de links).
  const usesCount = (k: string) => !["profile", "comments", "stories"].includes(k);
  const needCount = selectedItems.some((i) => usesCount(i.key) && !(i.key === "transcription" && hasLinks));
  // Rótulo do campo de quantidade, adapta ao tipo de análise selecionado.
  const countLabel = (() => {
    const uniq = Array.from(new Set(selectedItems.filter((i) => usesCount(i.key) && !(i.key === "transcription" && hasLinks)).map((i) => i.key)));
    if (uniq.length === 1) {
      const k = uniq[0];
      if (k === "ads") return "Quantos anúncios";
      if (k === "reels" || k === "transcription") return "Quantos reels";
      if (k === "mentions") return "Quantas menções";
      if (k === "hashtag") return "Quantos posts (hashtag)";
    }
    return "Quantos posts (mais recentes)";
  })();

  const addLink = () => setReelLinks((l) => [...l, ""]);
  const setLinkAt = (i: number, v: string) => setReelLinks((l) => l.map((x, idx) => (idx === i ? v : x)));
  const removeLink = (i: number) => setReelLinks((l) => (l.length <= 1 ? [""] : l.filter((_, idx) => idx !== i)));

  // Saldo de créditos do mês. O HUB tem custo VARIÁVEL (o Apify cobra por
  // resultado): sem cota, o prejuízo é do CRIA; sem MOSTRAR a cota, a surpresa
  // é da pessoa. As duas coisas são inaceitáveis.
  const { data: credits } = useHubCredits();
  // Fail-closed: se a leitura da cota FALHOU (RPC hub_credits_status caiu), não
  // liberamos gasto pago do Apify às cegas. Diferente de "sem cota" (quota 0
  // legítima), aqui travamos a ação e pedimos pra tentar de novo.
  const creditsError = credits?.error === true;
  const quota = credits?.quota ?? 0;
  const usados = credits?.used ?? 0;
  const restantes = Math.max(0, quota - usados);
  const pctUso = quota > 0 ? Math.min(100, Math.round((usados / quota) * 100)) : 0;
  const custoSelecao = selectedItems.reduce((s, i) => s + (CREDITOS_POR_TIPO[i.key] ?? 1), 0);

  // Pacote extra: reusa o checkout de módulo que já existe (module_code hub_extra),
  // então não precisou de edge nova. É cumulativo: pode comprar mais de um.
  const [comprandoExtra, setComprandoExtra] = useState(false);
  const comprarExtra = async () => {
    setComprandoExtra(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-module-checkout", {
        body: { module_code: "hub_extra" },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("checkout sem URL");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui abrir o checkout.");
      setComprandoExtra(false);
    }
  };

  // O RADAR: os concorrentes salvos deste cliente.
  const { data: competidores = [] } = useCompetitors(clientId);
  const addComp = useAddCompetitor();
  const delComp = useDeleteCompetitor();
  const [compSel, setCompSel] = useState<string | null>(null);
  const [novoComp, setNovoComp] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // Escolheu um concorrente do radar → o @ vem preenchido dele.
  const compAtivo = competidores.find((c) => c.id === compSel) ?? null;
  useEffect(() => {
    if (compAtivo) setHandle("@" + compAtivo.handle);
  }, [compAtivo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [filtroHist, setFiltroHist] = useState<FiltroHist>("tudo");

  const doneScrapes = useMemo(() => scrapes.filter((s) => s.status === "done" && s.result_summary), [scrapes]);
  const matchesFilter = (i: CreativeIdea) => filter === "todas" || i.status === filter;
  // Agrupa as ideias por análise (scrape_id), cada pesquisa mostra as SUAS ideias, não um banco global.
  const ideasByScrape = useMemo(() => {
    const m: Record<string, CreativeIdea[]> = {};
    for (const idea of ideas) {
      const k = (idea as { scrape_id?: string | null }).scrape_id || "__orphan__";
      (m[k] ||= []).push(idea);
    }
    return m;
  }, [ideas]);
  const orphanIdeas = useMemo(() => (ideasByScrape["__orphan__"] || []).filter(matchesFilter), [ideasByScrape, filter]);

  const historico = useMemo(
    () => doneScrapes.filter((s) => casaFiltro(s, filtroHist, ideasByScrape)),
    [doneScrapes, filtroHist, ideasByScrape],
  );

  const toggle = (k: string) => setSelected((s) => ({ ...s, [k]: !s[k] }));

  const analisar = async () => {
    if (selectedItems.length === 0) { toast.error("Escolha ao menos uma análise."); return; }
    // Fail-closed: cota não lida = não gastamos. Melhor pedir pra tentar de novo
    // do que liberar uma análise paga sem saber se ela cabe no saldo.
    if (creditsError) { toast.error("Não consegui conferir seu saldo de créditos agora. Tente de novo em instantes."); return; }
    // Transcrição: usa os links do reel se preenchidos, senão o @.
    const inputFor = (it: TypeDef) =>
      it.key === "transcription" ? (hasLinks ? validLinks.join(",") : handle.trim())
      : it.inputKind === "url" ? postUrl
      : it.inputKind === "hashtag" ? tag
      : handle;
    for (const it of selectedItems) {
      const inp = inputFor(it);
      if (!inp.trim()) {
        const what = it.key === "transcription" ? "o @ ou o link do reel"
          : it.inputKind === "url" ? "a URL do post"
          : it.inputKind === "hashtag" ? "a hashtag" : "o @ do concorrente";
        toast.error(`Falta preencher ${what} para "${it.label}".`); return;
      }
    }
    for (const it of selectedItems) {
      const inp = inputFor(it);
      setRunning(it.label);
      try {
        await run.mutateAsync({
          type: it.key, input: inp.trim(), crm_client_id: clientId,
          // Amarra a leitura ao concorrente do radar — é o que permite o
          // "sem leitura há 31 dias" depois.
          competitor_id: compAtivo && it.inputKind === "handle" ? compAtivo.id : null,
          limit, since: since || undefined,
        });
      } catch { /* toast já no hook */ }
    }
    setRunning(null);
  };

  return (
    <div className="space-y-5">
      {/* CABEÇALHO DO MÓDULO. Antes a aba abria direto num formulário cinza, sem
          dizer o que ela é nem o que ela vale. Agora ela se apresenta — e mostra
          o saldo, que é o que a pessoa precisa saber ANTES de escolher a análise. */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5">
        <OrganicBlobs color="lilas" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 mb-2">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-[10px] font-body font-bold uppercase tracking-wider">Cria Radar</span>
            </span>
            <h2 className="font-display text-xl font-extrabold text-foreground tracking-tight">
              Chegue na pauta com inteligência, não com achismo
            </h2>
            <p className="text-[13px] font-body text-muted-foreground mt-1 leading-relaxed max-w-xl">
              O CRIA lê o concorrente de verdade — o que engajou, o roteiro do reel que bombou,
              os anúncios que ele <strong>paga</strong> pra rodar — e devolve <strong>pautas prontas</strong> pro seu cliente.
            </p>
          </div>

          {/* SALDO. O HUB tem custo variável de verdade; a pessoa merece saber
              quanto ainda tem antes de clicar, não depois de levar um erro. */}
          {quota > 0 && (
            <div className="relative w-full sm:w-auto sm:shrink-0 rounded-2xl border border-border bg-background/70 backdrop-blur-sm px-4 py-3 sm:min-w-[168px]">
              <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground">Créditos deste mês</p>
              <p className="font-display text-2xl font-extrabold text-foreground tabular-nums leading-none mt-1">
                {restantes}<span className="text-sm font-bold text-muted-foreground">/{quota}</span>
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", restantes === 0 ? "bg-destructive" : pctUso > 80 ? "bg-amber-500" : "bg-primary")}
                  style={{ width: `${100 - pctUso}%` }}
                />
              </div>
              {/* O pacote extra aparece QUANDO ela precisa dele — não numa
                  tabela de preços que ela nunca vai abrir. */}
              {pctUso >= 80 && (
                <button
                  onClick={comprarExtra}
                  disabled={comprandoExtra}
                  className="mt-2 w-full rounded-lg bg-primary px-2 py-1.5 text-[11px] font-display font-bold text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
                >
                  {comprandoExtra ? "Abrindo…" : restantes === 0 ? "Acabou · +20 por R$ 24,90" : "+20 créditos · R$ 24,90"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ANALISANDO. Antes o botão só girava e a pessoa não sabia o que estava
          acontecendo — e como a análise às vezes leva minutos, ela achava que
          tinha travado (e travava mesmo, era o bug do timeout). */}
      {running && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.04] px-4 py-3.5">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
          <div className="min-w-0">
            <p className="text-[13px] font-display font-bold text-foreground">Analisando: {running}</p>
            <p className="text-[12px] font-body text-muted-foreground leading-tight">
              Estamos lendo o perfil de verdade — isso leva de 20 segundos a 2 minutos. Pode deixar a aba aberta.
            </p>
          </div>
        </div>
      )}

      {/* ═══ O RADAR ═══
          Os concorrentes são um ATIVO da ficha do cliente, como o brandbook —
          não um "passo 1" de um formulário. Antes a pessoa redigitava o @ toda
          vez e o sistema não fazia ideia de que aquele perfil importava. É o
          radar que permite a frase que a traz de volta sozinha: "sem leitura
          há 31 dias". */}
      {clientId && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">
              Concorrentes deste cliente
            </p>
            {competidores.length > 0 && !addOpen && (
              <button onClick={() => setAddOpen(true)} className="text-[12px] font-body font-bold text-primary hover:underline">
                + adicionar
              </button>
            )}
          </div>

          {addOpen && (
            <div className="flex gap-2 mb-3">
              <Input
                autoFocus
                value={novoComp}
                onChange={(e) => setNovoComp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && novoComp.trim()) {
                    addComp.mutate({ handle: novoComp, crm_client_id: clientId },
                      { onSuccess: () => { setNovoComp(""); setAddOpen(false); } });
                  }
                  if (e.key === "Escape") { setNovoComp(""); setAddOpen(false); }
                }}
                placeholder="@concorrente"
                className="h-9 max-w-xs"
              />
              <Button
                size="sm" className="h-9"
                disabled={!novoComp.trim() || addComp.isPending}
                onClick={() => addComp.mutate({ handle: novoComp, crm_client_id: clientId },
                  { onSuccess: () => { setNovoComp(""); setAddOpen(false); } })}
              >
                {addComp.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Adicionar"}
              </Button>
              <Button size="sm" variant="ghost" className="h-9" onClick={() => { setNovoComp(""); setAddOpen(false); }}>
                Cancelar
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {competidores.map((c) => {
              const dias = diasSemLeitura(c);
              const on = compSel === c.id;
              const frio = dias != null && dias >= 21;
              return (
                <button
                  key={c.id}
                  onClick={() => setCompSel(on ? null : c.id)}
                  className={cn(
                    "group relative text-left rounded-2xl border-2 bg-card p-3.5 transition-all hover:-translate-y-0.5",
                    on ? "shadow-sm" : "border-border hover:border-primary/40",
                  )}
                  style={on ? { borderColor: CRIA_HEX.lilas, background: `${CRIA_HEX.lilas}0a` } : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display font-extrabold text-[13px] text-white"
                      style={{ background: `linear-gradient(135deg, ${CRIA_HEX.lilas}, #a6b4f6)` }}
                    >
                      {c.handle.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-display font-bold text-foreground truncate">@{c.handle}</span>
                      <span className="block text-[11.5px] font-body text-muted-foreground truncate">
                        {dias == null
                          ? "Nunca foi lido"
                          : frio
                            ? `Sem leitura há ${dias} dias`
                            : `Lido ${haQuanto(c.last_read_at!)}`}
                      </span>
                    </span>
                  </div>

                  {/* O alerta que traz a pessoa de volta sem você mandar e-mail. */}
                  {(frio || dias == null) && (
                    <span className="inline-block mt-2 text-[10px] font-body font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700">
                      {dias == null ? "esperando a 1ª leitura" : "esfriando"}
                    </span>
                  )}

                  <span
                    role="button"
                    tabIndex={0}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (await confirmar({ titulo: `Tirar @${c.handle} do radar?`, descricao: "As leituras que você já fez dele continuam no histórico." , acao: "Tirar do radar" })) delComp.mutate(c.id);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="absolute right-2 top-2 rounded-lg p-1 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive transition-colors"
                    aria-label="Tirar do radar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}

            {competidores.length === 0 && !addOpen && (
              <button
                onClick={() => setAddOpen(true)}
                className="rounded-2xl border-2 border-dashed border-border bg-card p-5 text-center transition-colors hover:border-primary/40"
              >
                <Plus className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <span className="block text-[13px] font-display font-bold text-foreground">Adicionar o 1º concorrente</span>
                <span className="block text-[11.5px] font-body text-muted-foreground mt-0.5">
                  Ele fica salvo neste cliente. Você não digita o @ de novo.
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Config */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        {/* O SELETOR VIRA CHIP.
            Eram OITO cartões com um parágrafo de descrição cada, ocupando a tela
            inteira pra uma decisão de 2 segundos. A explicação agora mora no
            tooltip; na tela fica o que importa: o nome e quanto custa. */}
        <p className="text-sm font-display font-extrabold text-foreground">
          O que você quer saber
          {compAtivo && <span className="text-primary"> sobre @{compAtivo.handle}</span>}?
        </p>
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g.group}>
              <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground">{g.group}</p>
              {/* O `hint` do grupo existia nos dados e NUNCA era renderizado. */}
              <p className="text-[11.5px] font-body text-muted-foreground mb-2 leading-snug">{g.hint}</p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((it) => {
                  const on = !!selected[it.key];
                  const Icon = it.icon;
                  const cr = CREDITOS_POR_TIPO[it.key] ?? 1;
                  return (
                    <button
                      key={it.key}
                      onClick={() => toggle(it.key)}
                      title={it.desc}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-[13px] font-body font-semibold transition-all",
                        on ? "text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                      style={on ? { borderColor: CRIA_HEX.lilas, background: `${CRIA_HEX.lilas}0f` } : undefined}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" style={on ? { color: CRIA_HEX.lilas } : undefined} />
                      {it.label}
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                        style={on
                          ? { background: `${CRIA_HEX.lilas}26`, color: "#4a5cc0" }
                          : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                      >
                        {cr}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* O QUE A ESCOLHA SIGNIFICA — visível em qualquer tela.
            Eu tinha jogado a descrição pro `title` (tooltip). No celular NÃO existe
            hover: a pessoa via oito chips e nenhuma explicação. Agora o texto do
            que está marcado aparece aqui embaixo, pra todo mundo. */}
        {selectedItems.length > 0 && (
          <div className="rounded-xl bg-muted/40 px-3.5 py-2.5 space-y-1.5">
            {selectedItems.map((it) => (
              <p key={it.key} className="text-[12px] font-body text-muted-foreground leading-snug">
                <strong className="font-display text-foreground">{it.label}:</strong> {it.desc}
              </p>
            ))}
          </div>
        )}

        {/* Inputs */}
        {selectedItems.length > 0 && (
          <div className="pt-3 border-t border-border/60 space-y-3">
            <p className="text-sm font-display font-extrabold text-foreground">Dados da busca</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {needHandle && (
                <Field label="@ do concorrente">
                  <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@concorrente" className="h-9" />
                </Field>
              )}
              {needUrl && (
                <Field label="URL do post (p/ comentários)">
                  <Input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://instagram.com/p/..." className="h-9" />
                </Field>
              )}
              {needTag && (
                <Field label="Hashtag">
                  <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="esteticafacial" className="h-9" />
                </Field>
              )}
              {needCount && (
                <Field label={countLabel}>
                  <Input type="number" min={1} max={20} value={limit} onChange={(e) => setLimit(Math.max(1, Math.min(20, Number(e.target.value) || 10)))} className="h-9" />
                  {hasTranscription && <p className="text-[10px] font-body text-muted-foreground mt-1">Vale só no modo @ (quantos reels recentes puxar). Com links, transcreve os que você colar.</p>}
                </Field>
              )}
              {!noPeriod && (
                <Field label="Ou desde a data (opcional)">
                  <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="h-9" />
                </Field>
              )}
            </div>
            {/* Links de reel individuais (transcrição), @ OU links */}
            {hasTranscription && (
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] font-body font-semibold text-foreground mb-1.5">Link(s) do(s) reel(s), opcional (ou use o @ acima)</p>
                <div className="space-y-2">
                  {reelLinks.map((lnk, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={lnk}
                        onChange={(e) => setLinkAt(i, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (i === reelLinks.length - 1 && lnk.trim()) addLink(); } }}
                        placeholder="https://instagram.com/reel/..."
                        className="h-9 flex-1"
                      />
                      <button type="button" onClick={() => removeLink(i)} className="text-muted-foreground hover:text-destructive shrink-0" title="Remover" aria-label="Remover link"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8 mt-2 text-xs" onClick={addLink}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar link
                </Button>
                {hasLinks && <p className="text-[10px] font-body text-secondary mt-1.5">{validLinks.length} reel(s), transcreve exatamente esses.</p>}
              </div>
            )}
            {/* O CUSTO ANTES DO CLIQUE. A pessoa precisa saber quanto vai gastar
                enquanto ainda pode mudar de ideia — não depois, num erro. */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={analisar} disabled={!!running || creditsError || (quota > 0 && custoSelecao > restantes)} size="lg">
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {running ? `Analisando ${running}…` : `Analisar${quota > 0 ? ` · ${custoSelecao} ${custoSelecao === 1 ? "crédito" : "créditos"}` : ` (${selectedItems.length})`}`}
              </Button>
              {creditsError ? (
                <p className="text-[12px] font-body text-destructive">
                  Não consegui conferir seu saldo de créditos agora. Recarregue a página e tente de novo antes de rodar uma análise.
                </p>
              ) : quota > 0 && custoSelecao > restantes ? (
                <p className="text-[12px] font-body text-destructive">
                  Você tem {restantes} {restantes === 1 ? "crédito" : "créditos"} e essa seleção custa {custoSelecao}. Tire uma análise ou compre um pacote extra.
                </p>
              ) : (
                <p className="text-[11.5px] font-body text-muted-foreground">
                  Roda uma por vez. Cada uma leva de 20s a 2 min — a gente avisa quando terminar.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ O QUE JÁ FOI LIDO ═══
          Antes existiam duas seções concorrendo: "Análises" e "Ideias de
          conteúdo", com as ideias repetidas nas duas. Agora é UMA linha do tempo:
          cada leitura traz a sua conclusão, e o destino das pautas que ela gerou.
          O filtro é por INTENÇÃO (conteúdo, roteiro, mercado), não pelo nome
          técnico do scraper — e tem o "virou post", que é o que ela mostra pro
          cliente na hora de renovar o contrato. */}
      <div>
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-display font-extrabold text-foreground">
              {clientId ? "O que já foi lido deste cliente" : "Suas pesquisas avulsas"}
            </h3>
            <p className="text-[12px] font-body text-muted-foreground">
              Cada leitura, o que ela concluiu e o que virou.
            </p>
          </div>

          {doneScrapes.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {FILTROS.map((f) => {
                const n = f.key === "tudo" ? doneScrapes.length : doneScrapes.filter((s) => casaFiltro(s, f.key, ideasByScrape)).length;
                if (n === 0 && f.key !== "tudo") return null;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFiltroHist(f.key)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12px] font-body font-semibold transition-colors",
                      filtroHist === f.key
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label} <span className="opacity-60">{n}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {historico.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl py-14 px-6 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-display font-bold text-foreground">
              {doneScrapes.length === 0 ? "Nada foi lido ainda" : "Nenhuma leitura desse tipo"}
            </p>
            <p className="text-[13px] font-body text-muted-foreground mt-1 max-w-sm mx-auto">
              {doneScrapes.length === 0
                ? "Escolha um concorrente aí em cima e rode a primeira leitura. Em 2 minutos você tem pauta pronta."
                : "Troque o filtro pra ver as outras."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {historico.map((s, i) => (
              <SummaryCard
                key={s.id}
                summary={s.result_summary as Record<string, unknown>}
                handle={s.input_handle}
                quando={s.created_at}
                custo={s.cost_usd}
                defaultOpen={i === 0}
                onDelete={() => delScrape.mutate(s.id)}
                ideas={ideasByScrape[s.id] || []}
                onIdeaStatus={(id, status) => upd.mutate({ id, status })}
                onIdeaDelete={(id) => del.mutate(id)}
                aoCriarPosts={
                  clientId && extClient
                    ? () => genPlan.mutate({ externalClientId: (extClient as { id: string }).id, ideas: ideasByScrape[s.id] || [] })
                    : undefined
                }
                criandoPosts={genPlan.isPending}
              />
            ))}
          </div>
        )}

        {/* Ideias que existem sem análise (vieram do banco de ideias antigo). */}
        {orphanIdeas.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Pautas sem leitura vinculada
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {orphanIdeas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} onStatus={(id, status) => upd.mutate({ id, status })} onDelete={(id) => del.mutate(id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IdeaCard({ idea, onStatus, onDelete }: { idea: CreativeIdea; onStatus: (id: string, status: CreativeIdea["status"]) => void; onDelete: (id: string) => void }) {
  const sm = STATUS_META[idea.status];
  return (
    <div className="bg-card border border-border rounded-xl p-3.5 flex flex-col">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {idea.format && <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{idea.format}</span>}
            <span className={cn("text-[10px] font-body px-1.5 py-0.5 rounded-full", sm.cls)}>{sm.label}</span>
          </div>
          <p className="text-sm font-body font-semibold text-foreground leading-snug">{idea.title}</p>
          {idea.rationale && <p className="text-[12px] font-body text-muted-foreground mt-1 leading-relaxed">{idea.rationale}</p>}
        </div>
        <button onClick={() => onDelete(idea.id)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-border/60">
        <IdeaBtn active={idea.status === "usar"} onClick={() => onStatus(idea.id, "usar")} icon={<Check className="h-3 w-3" />}>Usar</IdeaBtn>
        <IdeaBtn active={idea.status === "usada"} onClick={() => onStatus(idea.id, "usada")}>Usada</IdeaBtn>
        <IdeaBtn active={idea.status === "descartada"} onClick={() => onStatus(idea.id, "descartada")} icon={<X className="h-3 w-3" />}>Descartar</IdeaBtn>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  );
}

function IdeaBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-body border transition-colors", active ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
      {icon}{children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TOP POST, antes era uma linha de texto cortada, sem capa e sem link.
// A pessoa lia "média de curtidas: 0" e fechava a tela. O dado do post
// (capa, link, transcrição) já vinha do Apify, a tela é que jogava fora.
// ═══════════════════════════════════════════════════════════════════════
function TopPostCard({ p, rank }: { p: any; rank: number }) {
  const [aberto, setAberto] = useState(false);
  const legenda = String(p.caption || "");
  const transcricao = String(p.transcript || "");
  const longo = legenda.length > 160 || transcricao.length > 200;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex gap-3 p-3">
        {/* Capa. Clicou, abre o post no Instagram. */}
        {p.url ? (
          <a href={p.url} target="_blank" rel="noopener noreferrer"
            className="group relative h-24 w-24 shrink-0 rounded-lg overflow-hidden border border-border bg-muted grid place-items-center">
            {p.thumbnail
              ? <img src={p.thumbnail} referrerPolicy="no-referrer" alt="" loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
              : <Instagram className="h-5 w-5 text-muted-foreground/40" />}
            <span className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors grid place-items-center">
              <ExternalLink className="h-4 w-4 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
            </span>
          </a>
        ) : (
          <div className="h-24 w-24 shrink-0 rounded-lg border border-border bg-muted grid place-items-center">
            {p.thumbnail
              ? <img src={p.thumbnail} referrerPolicy="no-referrer" alt="" loading="lazy" className="h-full w-full object-cover rounded-lg" />
              : <Instagram className="h-5 w-5 text-muted-foreground/40" />}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-[10px] font-body font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">#{rank}</span>
            {p.format && <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0">{p.format}</span>}
            <span className="flex items-center gap-0.5 text-[11px] font-body text-muted-foreground"><Heart className="h-3 w-3" />{fmtNum(p.likes)}</span>
            <span className="flex items-center gap-0.5 text-[11px] font-body text-muted-foreground"><MessageCircle className="h-3 w-3" />{fmtNum(p.comments)}</span>
            {p.views != null && <span className="flex items-center gap-0.5 text-[11px] font-body text-muted-foreground"><Play className="h-3 w-3" />{fmtNum(p.views)}</span>}
          </div>

          <p className={cn("text-[12.5px] font-body text-foreground leading-snug whitespace-pre-wrap", !aberto && "line-clamp-3")}>
            {legenda || "(sem legenda)"}
          </p>

          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-body font-semibold text-primary hover:underline mt-1.5">
              <ExternalLink className="h-3 w-3" /> ver o post
            </a>
          )}
        </div>
      </div>

      {/* O RESUMO DA IA: em uma frase, do que é o reel. É o que faz a pessoa
          decidir se vale ler o roteiro inteiro ou pular pro próximo. */}
      {p.resumo && (
        <div className="border-t border-border/60 px-3 py-2" style={{ background: `${CRIA_HEX.lilas}0d` }}>
          <p className="text-[12px] font-body text-foreground leading-relaxed">
            <strong className="font-display">Em uma frase:</strong> {p.resumo}
          </p>
        </div>
      )}

      {/* A TRANSCRIÇÃO, é o roteiro do concorrente. É o produto desta análise. */}
      {transcricao && (
        <div className="border-t border-border/60 bg-muted/30 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> Roteiro (áudio transcrito)
            </p>
            <button
              onClick={() => { void navigator.clipboard.writeText(transcricao); toast.success("Roteiro copiado."); }}
              className="text-[10px] font-body font-bold text-primary hover:underline shrink-0"
            >
              copiar roteiro
            </button>
          </div>
          <p className={cn("text-[12.5px] font-body text-foreground/90 leading-relaxed whitespace-pre-wrap", !aberto && "line-clamp-4")}>
            {transcricao}
          </p>
        </div>
      )}

      {longo && (
        <button onClick={() => setAberto((a) => !a)}
          className="w-full py-1.5 text-[11px] font-body font-semibold text-primary hover:bg-muted/40 border-t border-border/60 transition-colors">
          {aberto ? "mostrar menos" : "ler tudo"}
        </button>
      )}
    </div>
  );
}

/**
 * A LEITURA DA ANÁLISE.
 *
 * O erro do que existia: a tela DESPEJAVA o dado (contagem, média, lista) e
 * deixava a pessoa fazer a interpretação sozinha. Mas ela não paga pra ver
 * número — paga pra ter a CONCLUSÃO. Aqui a gente lê os dados e escreve a frase
 * que ela repetiria na reunião com o cliente.
 */
function lerAnalise(s: Record<string, any>): string | null {
  const kind = s.kind;
  const fmts: Record<string, number> = s.formats || {};
  const total = Number(s.count) || 0;

  if (kind === "comments") {
    return total > 0
      ? `Foram ${total} comentários lidos. As dúvidas que se repetem viraram pauta aqui embaixo — é o público dizendo o que quer ouvir.`
      : null;
  }
  if (kind === "ads") {
    return total > 0
      ? `Ele mantém ${total} ${total === 1 ? "anúncio ativo" : "anúncios ativos"}. Isso é dinheiro dele apostando: a oferta e o ângulo abaixo já foram testados e ele decidiu pagar pra repetir.`
      : null;
  }
  if (kind === "profile") return null;

  if (!total) return null;

  const partes: string[] = [];
  const dominante = Object.entries(fmts).sort((a, b) => b[1] - a[1])[0];
  if (dominante && total > 2) {
    const nome = /clips|video/i.test(dominante[0]) ? "Reels"
      : /sidecar|carousel/i.test(dominante[0]) ? "carrossel"
      : /image|graph/i.test(dominante[0]) ? "foto" : dominante[0];
    partes.push(`o formato que ele mais usa é ${nome} (${dominante[1]} de ${total})`);
  }
  if (s.avg_likes) partes.push(`a média é de ${fmtNum(s.avg_likes)} curtidas por post`);
  if (s.avg_views) partes.push(`${fmtNum(s.avg_views)} views por vídeo`);

  if (kind === "transcription") {
    return `Os roteiros abaixo são o áudio transcrito dos reels que mais rodaram${partes.length ? ` — ${partes[0]}` : ""}. Leia o gancho dos primeiros segundos: é ali que a retenção é ganha ou perdida.`;
  }
  return partes.length ? `Lendo ${total} publicações: ${partes.join(", ")}.` : null;
}

export function SummaryCard({
  summary, handle, quando, custo, defaultOpen = false, onDelete, ideas, onIdeaStatus, onIdeaDelete,
  aoCriarPosts, criandoPosts,
}: {
  summary: Record<string, unknown>; handle: string;
  quando?: string; custo?: number | null;
  defaultOpen?: boolean; onDelete?: () => void;
  ideas?: CreativeIdea[];
  onIdeaStatus?: (id: string, status: CreativeIdea["status"]) => void;
  onIdeaDelete?: (id: string) => void;
  aoCriarPosts?: () => void; criandoPosts?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const s = summary as Record<string, any>;
  const kind = s.kind;
  const KIND_LABEL: Record<string, string> = {
    profile: "Raio-x do perfil", comments: "As dúvidas do público", ads: "Onde ele aposta dinheiro",
    posts: "O que ele posta", reels: "Os reels dele", hashtag: "A hashtag do nicho",
    mentions: "Quem fala dele", transcription: "O roteiro do reel que bombou",
  };
  const count = typeof s.count === "number" ? s.count : (Array.isArray(s.top) ? s.top.length : null);
  const shortHandle = handle.length > 40 ? handle.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").slice(0, 30) + "…" : handle;
  const leitura = lerAnalise(s);
  const hex = COR_DO_TIPO[String(kind)] ?? CRIA_HEX.lilas;

  // O DESTINO das pautas. É o número que prova que a leitura de 3 créditos virou
  // post publicado — e é o que ela mostra pro cliente na renovação do contrato.
  const usadas = (ideas ?? []).filter((i) => i.status === "usada").length;
  const marcadas = (ideas ?? []).filter((i) => i.status === "usar").length;
  const novas = (ideas ?? []).filter((i) => i.status === "novo").length;

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden">
      {/* Cabeçalho na cor do HUB. O título diz o que a análise SIGNIFICA, não o
          nome técnico dela ("Posts" → "O que ele posta"). */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
        style={{ borderLeft: `4px solid ${hex}` }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${hex}1f`, color: hex }}>
          <Instagram className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-display font-extrabold text-foreground truncate">
            {KIND_LABEL[kind] || "Análise"}
          </span>
          <span className="block text-[11.5px] font-body text-muted-foreground truncate">
            @{shortHandle.replace(/^@/, "")}
            {count != null && ` · ${count} ${count === 1 ? "item lido" : "itens lidos"}`}
            {ideas && ideas.length > 0 && ` · ${ideas.length} pautas`}
          </span>
        </span>
        {onDelete && (
          <span role="button" tabIndex={0}
            onClick={async (e) => { e.stopPropagation(); if (await confirmar({ titulo: "Excluir esta análise?", descricao: "As pautas que ela gerou continuam no banco de ideias do cliente." })) onDelete(); }}
            onKeyDown={async (e) => { if (e.key === "Enter") { e.stopPropagation(); if (await confirmar({ titulo: "Excluir esta análise?", descricao: "As pautas que ela gerou continuam no banco de ideias do cliente." })) onDelete(); } }}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Excluir análise" aria-label="Excluir análise"><Trash2 className="h-4 w-4" /></span>
        )}
        {quando && <span className="hidden sm:block shrink-0 text-[11px] font-body text-muted-foreground">{haQuanto(quando)}</span>}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* O DESTINO, sempre visível — mesmo com o card fechado. Sem isso, a pessoa
          não sabe quais leituras ela já aproveitou e quais estão paradas. */}
      {ideas && ideas.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap border-t border-border/60 px-4 py-2">
          {usadas > 0 && (
            <span className="text-[11px] font-body font-bold px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700">
              {usadas} no cronograma
            </span>
          )}
          {marcadas > 0 && (
            <span className="text-[11px] font-body font-bold px-2 py-0.5 rounded-full" style={{ background: `${CRIA_HEX.lilas}22`, color: "#4a5cc0" }}>
              {marcadas} marcadas “usar”
            </span>
          )}
          {novas > 0 && (
            <span className="text-[11px] font-body px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {novas} {novas === 1 ? "nova · ninguém olhou" : "novas · ninguém olhou"}
            </span>
          )}
          {aoCriarPosts && marcadas > 0 && (
            <button
              onClick={aoCriarPosts}
              disabled={criandoPosts}
              className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-display font-bold text-primary hover:underline disabled:opacity-50"
            >
              {criandoPosts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
              Criar {marcadas} {marcadas === 1 ? "post" : "posts"}
            </button>
          )}
        </div>
      )}

      {open && (
      <div className="border-t border-border/60 p-4 sm:p-5">
        {/* A CONCLUSÃO, antes do dado. É o que ela leva pra reunião. */}
        {leitura && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl px-4 py-3" style={{ background: `${hex}0f` }}>
            <Sparkles className="h-4 w-4 shrink-0 mt-0.5" style={{ color: hex }} />
            <p className="text-[13px] font-body text-foreground leading-relaxed">{leitura}</p>
          </div>
        )}

        {kind === "profile" ? (
          <div className="flex items-start gap-4 flex-wrap">
            {s.avatar && (
              <img src={s.avatar} referrerPolicy="no-referrer" alt="" className="h-16 w-16 rounded-full object-cover border border-border shrink-0" />
            )}
            <div className="min-w-0 flex-1 w-full">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Stat label="Seguidores" value={fmtNum(s.followers)} />
                <Stat label="Seguindo" value={fmtNum(s.following)} />
                <Stat label="Posts" value={fmtNum(s.posts)} />
              </div>
              {s.biography && <p className="text-[13px] font-body text-muted-foreground mt-3 whitespace-pre-wrap leading-relaxed">{s.biography}</p>}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {s.verified && <span className="text-[10px] font-body px-2 py-0.5 rounded-full bg-primary/10 text-primary">✔ Verificado</span>}
                {s.isBusiness && <span className="text-[10px] font-body px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Comercial</span>}
                {s.category && <span className="text-[10px] font-body px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{s.category}</span>}
                {s.externalUrl && <a href={s.externalUrl} target="_blank" rel="noreferrer" className="text-[11px] font-body text-primary hover:underline truncate max-w-[240px]">{String(s.externalUrl).replace(/^https?:\/\//, "")}</a>}
              </div>
            </div>
          </div>

        ) : kind === "ads" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {Array.isArray(s.top) && s.top.slice(0, 12).map((a: any, i: number) => {
              const abrir = a.library_link || a.link || null;
              return (
                <div key={i} className="rounded-2xl border border-border overflow-hidden bg-card">
                  {/* A CAPA. Ela vinha vazia porque o criativo do anúncio mora em
                      lugares diferentes conforme o formato, e a gente só olhava dois.
                      Agora ela é grande: o criativo É o produto desta análise. */}
                  {a.thumbnail ? (
                    <a href={abrir ?? a.thumbnail} target="_blank" rel="noreferrer" className="group relative block bg-muted">
                      <img
                        src={a.thumbnail}
                        referrerPolicy="no-referrer"
                        alt=""
                        loading="lazy"
                        className="h-36 sm:h-44 w-full object-cover transition-transform group-hover:scale-[1.02]"
                        onError={(e) => { e.currentTarget.parentElement?.classList.add("hidden"); }}
                      />
                      <span className="absolute inset-0 grid place-items-center bg-foreground/0 transition-colors group-hover:bg-foreground/30">
                        <ExternalLink className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                    </a>
                  ) : null}

                  <div className="p-3.5">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      {a.active && (
                        <span className="text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">RODANDO</span>
                      )}
                      {a.since && (
                        <span className="text-[10.5px] font-body text-muted-foreground">
                          {/* Vinha "desde 1777446000" — epoch cru na cara do usuário. */}
                          no ar desde {new Date(a.since).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>

                    {a.titulo && (
                      <p className="text-[13px] font-display font-bold text-foreground leading-snug mb-1">{a.titulo}</p>
                    )}
                    <p className="text-[12.5px] font-body text-foreground leading-relaxed line-clamp-5 whitespace-pre-wrap">
                      {a.text || "(anúncio sem texto)"}
                    </p>

                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      {a.cta && (
                        <span className="text-[10px] font-display font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary">{a.cta}</span>
                      )}
                      {abrir && (
                        <a href={abrir} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-body font-bold text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> ver o anúncio
                        </a>
                      )}
                      {a.link && (
                        <a href={a.link} target="_blank" rel="noreferrer" className="ml-auto text-[11px] font-body text-muted-foreground hover:underline truncate max-w-[45%]">
                          leva pra {String(a.link).replace(/^https?:\/\/(www\.)?/, "").split("/")[0]} →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        ) : kind === "comments" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {Array.isArray(s.top) && s.top.slice(0, 14).map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-2.5 rounded-2xl border border-border px-3 py-2.5">
                <MessageCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: hex }} />
                <p className="text-[12.5px] font-body text-foreground flex-1 min-w-0 leading-relaxed">{c.text}</p>
                {c.likes > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] font-body text-muted-foreground shrink-0">
                    <Heart className="h-3 w-3" />{fmtNum(c.likes)}
                  </span>
                )}
              </div>
            ))}
          </div>

        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              <Stat label={kind === "transcription" ? "Reels lidos" : "Posts lidos"} value={fmtNum(s.count)} />
              <Stat label="Média curtidas" value={fmtNum(s.avg_likes)} />
              <Stat label="Média coment." value={fmtNum(s.avg_comments)} />
              <Stat label="Média views" value={s.avg_views ? fmtNum(s.avg_views) : "-"} />
            </div>
            {Array.isArray(s.top) && s.top.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">
                  {kind === "transcription" ? "Os roteiros, do que mais rodou pro que menos" : "Do que mais engajou pro que menos"}
                </p>
                {s.top.slice(0, 10).map((p: any, i: number) => (
                  <TopPostCard key={i} p={p} rank={i + 1} />
                ))}
              </div>
            )}
          </>
        )}

        {/* AS PAUTAS. É o produto. Antes ficavam enterradas no fim, com o mesmo
            peso visual de tudo o resto. Agora elas são o destaque. */}
        {ideas && ideas.length > 0 && onIdeaStatus && onIdeaDelete && (
          <div className="mt-5 rounded-2xl border-2 border-dashed p-4" style={{ borderColor: `${hex}59`, background: `${hex}08` }}>
            <p className="text-[13px] font-display font-extrabold text-foreground mb-0.5 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" style={{ color: hex }} />
              {ideas.length} {ideas.length === 1 ? "pauta pronta" : "pautas prontas"} pro seu cliente
            </p>
            <p className="text-[12px] font-body text-muted-foreground mb-3">
              Marque as boas como <strong>Usar</strong> e clique em “Criar posts” lá em cima: elas entram no cronograma dele.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {ideas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} onStatus={onIdeaStatus} onDelete={onIdeaDelete} />
              ))}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function ListWrap({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="text-lg font-display font-extrabold text-foreground">{value}</p>
      <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

function fmtNum(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace(".0", "") + "M";
  if (v >= 1000) return (v / 1000).toFixed(1).replace(".0", "") + "k";
  return String(v);
}

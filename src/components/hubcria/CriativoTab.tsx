import { useMemo, useState } from "react";
import {
  Loader2, Sparkles, Check, X, Trash2, Instagram, Heart, MessageCircle, Play, CalendarPlus,
  LayoutGrid, FileText, CircleDashed, User, AtSign, Hash, Megaphone, TrendingUp, Plus, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useScrapes, useCreativeIdeas, useRunScrape, useUpdateIdeaStatus, useDeleteIdea, useDeleteScrape, useGeneratePlanFromIdeas,
  type ScrapeType, type CreativeIdea,
} from "@/hooks/useHubCria";
import { useExternalClients } from "@/hooks/useCriaPost";

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

  const doneScrapes = useMemo(() => scrapes.filter((s) => s.status === "done" && s.result_summary).slice(0, 8), [scrapes]);
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

  const toggle = (k: string) => setSelected((s) => ({ ...s, [k]: !s[k] }));

  const analisar = async () => {
    if (selectedItems.length === 0) { toast.error("Escolha ao menos uma análise."); return; }
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
      try { await run.mutateAsync({ type: it.key, input: inp.trim(), crm_client_id: clientId, limit, since: since || undefined }); } catch { /* toast já no hook */ }
    }
    setRunning(null);
  };

  return (
    <div className="space-y-5">
      {/* Como funciona */}
      <div className="flex items-start gap-2 rounded-xl bg-primary/[0.04] border border-primary/15 px-4 py-3">
        <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-[13px] font-body text-foreground/80 leading-relaxed">
          Escolha <strong>uma ou mais</strong> análises, informe o concorrente e rode. O CRIA lê os dados reais e transforma no que engajou em <strong>ideias prontas</strong> pro cliente, que você marca como "usar" e manda pro cronograma.
        </p>
      </div>

      {/* Config */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <p className="text-sm font-display font-bold text-foreground">1. O que você quer analisar?</p>
        <div className="space-y-3">
          {GROUPS.map((g) => (
            <div key={g.group}>
              <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{g.group}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {g.items.map((it) => {
                  const on = !!selected[it.key];
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.key}
                      onClick={() => toggle(it.key)}
                      className={cn("flex items-start gap-2.5 text-left rounded-xl border p-3 transition-colors", on ? "border-primary bg-primary/[0.05]" : "border-border bg-card hover:border-primary/40")}
                    >
                      <span className={cn("mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0", on ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                        {on && <Check className="h-3 w-3 text-primary-foreground" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-[13px] font-body font-semibold text-foreground">{it.label}</span>
                          {it.cost && <span className="text-[9px] font-body px-1 py-0.5 rounded-full bg-amber-100 text-amber-700">pago</span>}
                        </div>
                        <p className="text-[11.5px] font-body text-muted-foreground leading-snug mt-0.5">{it.desc}{it.cost ? ` (${it.cost})` : ""}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Inputs */}
        {selectedItems.length > 0 && (
          <div className="pt-2 border-t border-border/60 space-y-3">
            <p className="text-sm font-display font-bold text-foreground">2. Dados da busca</p>
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
            <div className="flex items-center gap-3">
              <Button onClick={analisar} disabled={!!running}>
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {running ? `Analisando ${running}…` : `Analisar (${selectedItems.length})`}
              </Button>
              <p className="text-[11px] font-body text-muted-foreground">Roda um por um. Pode levar até ~1 min cada.</p>
            </div>
          </div>
        )}
      </div>

      {/* Resultados */}
      {doneScrapes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-display font-bold text-foreground">Análises</p>
          {doneScrapes.map((s, i) => (
            <SummaryCard
              key={s.id}
              summary={s.result_summary as Record<string, unknown>}
              handle={s.input_handle}
              defaultOpen={i === 0}
              onDelete={() => delScrape.mutate(s.id)}
              ideas={(ideasByScrape[s.id] || []).filter(matchesFilter)}
              onIdeaStatus={(id, status) => upd.mutate({ id, status })}
              onIdeaDelete={(id) => del.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Ideias, hub de ação. As ideias em si aparecem dentro de cada análise acima. */}
      <div>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-display font-bold text-foreground">Ideias de conteúdo</h3>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {clientId && extClient && (
              <Button size="sm" onClick={() => genPlan.mutate({ externalClientId: (extClient as { id: string }).id, ideas })} disabled={genPlan.isPending || usarCount === 0} title={usarCount === 0 ? "Marque ideias como 'Usar' primeiro" : ""}>
                {genPlan.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />}
                Criar posts na aba Posts ({usarCount})
              </Button>
            )}
            {ideas.length > 0 && (
              <div className="flex gap-1">
                {STATUS_FILTERS.map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={cn("px-2.5 py-1 rounded-full text-xs font-body border capitalize transition-colors", filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{f}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        {clientId && !extClient && ideas.length > 0 && (
          <p className="text-[11px] font-body text-muted-foreground mb-2">Ative o Cria Post neste cliente (aba Posts) pra transformar as ideias em posts.</p>
        )}

        {ideas.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl py-12 px-6 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-body text-foreground font-medium">Nenhuma ideia ainda</p>
            <p className="text-xs font-body text-muted-foreground mt-1">Rode uma análise acima pra gerar ideias.</p>
          </div>
        ) : (
          <>
            <p className="text-[12px] font-body text-muted-foreground mb-3">As ideias aparecem <strong>dentro de cada análise</strong> acima, cada pesquisa gera as suas. Marque como "Usar" e clique em "Criar posts na aba Posts".</p>
            {orphanIdeas.length > 0 && (
              <>
                <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ideias sem análise vinculada</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {orphanIdeas.map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} onStatus={(id, status) => upd.mutate({ id, status })} onDelete={(id) => del.mutate(id)} />
                  ))}
                </div>
              </>
            )}
          </>
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
              <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
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

      {/* A TRANSCRIÇÃO, é o roteiro do concorrente. É o produto desta análise. */}
      {transcricao && (
        <div className="border-t border-border/60 bg-muted/30 px-3 py-2.5">
          <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
            <FileText className="h-3 w-3" /> Roteiro (transcrição do áudio)
          </p>
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

export function SummaryCard({ summary, handle, defaultOpen = false, onDelete, ideas, onIdeaStatus, onIdeaDelete }: { summary: Record<string, unknown>; handle: string; defaultOpen?: boolean; onDelete?: () => void; ideas?: CreativeIdea[]; onIdeaStatus?: (id: string, status: CreativeIdea["status"]) => void; onIdeaDelete?: (id: string) => void }) {
  const [open, setOpen] = useState(defaultOpen);
  const s = summary as Record<string, any>;
  const kind = s.kind;
  const KIND_LABEL: Record<string, string> = {
    profile: "Perfil", comments: "Comentários", ads: "Anúncios", stories: "Stories",
    posts: "Posts", reels: "Reels", hashtag: "Hashtag", mentions: "Menções", transcription: "Reels + transcrição",
  };
  const count = typeof s.count === "number" ? s.count : (Array.isArray(s.top) ? s.top.length : null);
  const shortHandle = handle.length > 40 ? handle.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").slice(0, 30) + "…" : handle;
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-background text-left hover:bg-muted/30 transition-colors">
        <Instagram className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-display font-bold text-foreground truncate flex-1 min-w-0">{KIND_LABEL[kind] || "Análise"} · {shortHandle}</h3>
        {count != null && <span className="text-[11px] font-body text-muted-foreground shrink-0">{count} {count === 1 ? "item" : "itens"}</span>}
        {onDelete && (
          <span role="button" tabIndex={0}
            onClick={(e) => { e.stopPropagation(); if (confirm("Excluir esta análise?")) onDelete(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); if (confirm("Excluir esta análise?")) onDelete(); } }}
            className="shrink-0 text-muted-foreground hover:text-destructive" title="Excluir análise" aria-label="Excluir análise"><Trash2 className="h-4 w-4" /></span>
        )}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
      <div className="p-4">
        {kind === "profile" ? (
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Seguidores" value={fmtNum(s.followers)} />
            <Stat label="Seguindo" value={fmtNum(s.following)} />
            <Stat label="Posts" value={fmtNum(s.posts)} />
            {s.biography && <p className="col-span-3 text-[13px] font-body text-muted-foreground mt-1 whitespace-pre-wrap">{s.biography}</p>}
            <div className="col-span-3 flex flex-wrap items-center gap-1.5 mt-1">
              {s.verified && <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">✔ Verificado</span>}
              {s.isBusiness && <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Comercial</span>}
              {s.category && <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{s.category}</span>}
              {s.externalUrl && <a href={s.externalUrl} target="_blank" rel="noreferrer" className="text-[11px] font-body text-primary hover:underline truncate max-w-[220px]">🔗 {String(s.externalUrl).replace(/^https?:\/\//, "")}</a>}
            </div>
          </div>
        ) : kind === "ads" ? (
          <ListWrap title={`${fmtNum(s.count)} anúncios ativos, a oferta que ele paga pra promover`}>
            {Array.isArray(s.top) && s.top.slice(0, 10).map((a: any, i: number) => (
              <div key={i} className="flex gap-2.5 rounded-lg border border-border/60 px-2.5 py-2">
                {a.thumbnail && (
                  <a href={a.library_link || a.link || a.thumbnail} target="_blank" rel="noreferrer" className="shrink-0">
                    <img src={a.thumbnail} referrerPolicy="no-referrer" alt="" loading="lazy" className="h-16 w-16 rounded-md object-cover border border-border/60 bg-muted" />
                  </a>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    {a.active && <span className="text-[9px] font-body px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary">ativo</span>}
                    {a.page && <span className="text-[10px] font-body text-muted-foreground">{a.page}</span>}
                    {a.since && <span className="text-[10px] font-body text-muted-foreground">· desde {String(a.since).slice(0, 10)}</span>}
                  </div>
                  <p className="text-[12px] font-body text-foreground leading-snug">{a.text || "(sem texto)"}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {a.library_link && <a href={a.library_link} target="_blank" rel="noreferrer" className="text-[11px] font-body text-primary hover:underline">ver na Ads Library →</a>}
                    {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="text-[11px] font-body text-muted-foreground hover:underline">destino →</a>}
                  </div>
                </div>
              </div>
            ))}
          </ListWrap>
        ) : kind === "stories" ? (
          <ListWrap title={`${fmtNum(s.count)} stories recentes`}>
            {Array.isArray(s.top) && s.top.slice(0, 12).map((x: any, i: number) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2">
                <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{x.type || "story"}</span>
                <p className="text-[12px] font-body text-foreground flex-1 min-w-0 leading-snug truncate">{x.caption || "(sem texto na tela)"}</p>
                {x.url && <a href={x.url} target="_blank" rel="noreferrer" className="text-[11px] font-body text-primary hover:underline shrink-0">ver</a>}
              </div>
            ))}
          </ListWrap>
        ) : kind === "comments" ? (
          <ListWrap title={`${fmtNum(s.count)} comentários, as dúvidas viram pauta`}>
            {Array.isArray(s.top) && s.top.slice(0, 12).map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-border/60 px-2.5 py-2">
                <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[12px] font-body text-foreground flex-1 min-w-0 leading-snug">{c.text}</p>
                {c.likes > 0 && <span className="flex items-center gap-0.5 text-[11px] font-body text-muted-foreground shrink-0"><Heart className="h-3 w-3" />{fmtNum(c.likes)}</span>}
              </div>
            ))}
          </ListWrap>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Stat label="Posts lidos" value={fmtNum(s.count)} />
              <Stat label="Média curtidas" value={fmtNum(s.avg_likes)} />
              <Stat label="Média coment." value={fmtNum(s.avg_comments)} />
              <Stat label="Formatos" value={Object.keys(s.formats || {}).length ? `${Object.keys(s.formats).length} tipos` : "-"} />
            </div>
            {Array.isArray(s.top) && s.top.length > 0 && (
              <ListWrap title="Top posts (o que mais engajou)">
                {s.top.slice(0, 8).map((p: any, i: number) => (
                  <TopPostCard key={i} p={p} rank={i + 1} />
                ))}
              </ListWrap>
            )}
          </>
        )}
        {ideas && ideas.length > 0 && onIdeaStatus && onIdeaDelete && (
          <div className="mt-4 pt-3 border-t border-border/60">
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Ideias desta análise ({ideas.length})
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

import { useMemo, useState } from "react";
import {
  Loader2, Sparkles, Check, X, Trash2, Instagram, Heart, MessageCircle, Play, CalendarPlus,
  LayoutGrid, FileText, CircleDashed, User, AtSign, Hash, Megaphone, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useScrapes, useCreativeIdeas, useRunScrape, useUpdateIdeaStatus, useDeleteIdea, useGeneratePlanFromIdeas,
  type ScrapeType, type CreativeIdea,
} from "@/hooks/useHubCria";
import { useExternalClients } from "@/hooks/useCriaPost";

type InputKind = "handle" | "url" | "hashtag";
type TypeDef = { key: ScrapeType; label: string; icon: typeof LayoutGrid; desc: string; inputKind: InputKind; cost?: string };

const GROUPS: { group: string; items: TypeDef[] }[] = [
  {
    group: "Conteúdo do concorrente",
    items: [
      { key: "posts", label: "Posts do feed", icon: LayoutGrid, desc: "Os posts que mais engajaram — legenda, curtidas, comentários e formato. Base pras ideias.", inputKind: "handle" },
      { key: "reels", label: "Reels", icon: Play, desc: "Os reels dele — views, duração e o que performou.", inputKind: "handle" },
      { key: "transcription", label: "Reels + transcrição", icon: FileText, desc: "Transcreve o áudio dos reels recentes pra ler o ROTEIRO do que viralizou.", inputKind: "handle", cost: "~US$0,015/reel" },
      { key: "stories", label: "Stories", icon: CircleDashed, desc: "Os stories recentes (somem em 24h) — o que ele faz no dia a dia.", inputKind: "handle" },
    ],
  },
  {
    group: "Público e mercado",
    items: [
      { key: "profile", label: "Perfil (raio-x)", icon: User, desc: "Seguidores, bio, categoria e link. Só panorama — não gera ideias.", inputKind: "handle" },
      { key: "comments", label: "Comentários", icon: MessageCircle, desc: "Os comentários de UM post → as dúvidas do público viram pauta. Precisa da URL do post.", inputKind: "url" },
      { key: "mentions", label: "Menções / UGC", icon: AtSign, desc: "Posts que marcam o @ — UGC, parceiros e oportunidades.", inputKind: "handle" },
      { key: "hashtag", label: "Hashtag", icon: Hash, desc: "O que está bombando numa hashtag do nicho.", inputKind: "hashtag" },
    ],
  },
  {
    group: "Estratégia",
    items: [
      { key: "ads", label: "Anúncios (Meta)", icon: Megaphone, desc: "Os anúncios ATIVOS dele — a oferta e o ângulo que ele PAGA pra promover.", inputKind: "handle", cost: "~US$0,006/anúncio" },
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
  const genPlan = useGeneratePlanFromIdeas();
  const { clients: extClients } = useExternalClients();
  const extClient = clientId ? extClients.find((c: { crm_client_id?: string | null }) => c.crm_client_id === clientId) : null;
  const usarCount = ideas.filter((i) => i.status === "usar").length;

  const selectedItems = ALL.filter((i) => selected[i.key]);
  const needHandle = selectedItems.some((i) => i.inputKind === "handle");
  const needUrl = selectedItems.some((i) => i.inputKind === "url");
  const needTag = selectedItems.some((i) => i.inputKind === "hashtag");
  const noPeriod = selectedItems.every((i) => ["profile", "comments", "stories"].includes(i.key));

  const doneScrapes = useMemo(() => scrapes.filter((s) => s.status === "done" && s.result_summary).slice(0, 8), [scrapes]);
  const filteredIdeas = useMemo(() => (filter === "todas" ? ideas : ideas.filter((i) => i.status === filter)), [ideas, filter]);

  const toggle = (k: string) => setSelected((s) => ({ ...s, [k]: !s[k] }));

  const analisar = async () => {
    if (selectedItems.length === 0) { toast.error("Escolha ao menos uma análise."); return; }
    for (const it of selectedItems) {
      const inp = it.inputKind === "url" ? postUrl : it.inputKind === "hashtag" ? tag : handle;
      if (!inp.trim()) { toast.error(`Falta preencher ${it.inputKind === "url" ? "a URL do post" : it.inputKind === "hashtag" ? "a hashtag" : "o @ do concorrente"} para "${it.label}".`); return; }
    }
    for (const it of selectedItems) {
      const inp = it.inputKind === "url" ? postUrl : it.inputKind === "hashtag" ? tag : handle;
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
          Escolha <strong>uma ou mais</strong> análises, informe o concorrente e rode. O CRIA lê os dados reais e transforma no que engajou em <strong>ideias prontas</strong> pro cliente — que você marca como "usar" e manda pro cronograma.
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
              {!noPeriod && (
                <>
                  <Field label="Quantos posts (mais recentes)">
                    <Input type="number" min={1} max={20} value={limit} onChange={(e) => setLimit(Math.max(1, Math.min(20, Number(e.target.value) || 10)))} className="h-9" />
                  </Field>
                  <Field label="Ou desde a data (opcional)">
                    <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="h-9" />
                  </Field>
                </>
              )}
            </div>
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
          {doneScrapes.map((s) => (
            <SummaryCard key={s.id} summary={s.result_summary as Record<string, unknown>} handle={s.input_handle} />
          ))}
        </div>
      )}

      {/* Ideias */}
      <div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-display font-bold text-foreground">Ideias de conteúdo</h3>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {clientId && extClient && (
              <Button size="sm" onClick={() => genPlan.mutate({ externalClientId: (extClient as { id: string }).id, ideas })} disabled={genPlan.isPending || usarCount === 0} title={usarCount === 0 ? "Marque ideias como 'Usar' primeiro" : ""}>
                {genPlan.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />}
                Gerar cronograma ({usarCount})
              </Button>
            )}
            <div className="flex gap-1">
              {STATUS_FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("px-2.5 py-1 rounded-full text-xs font-body border capitalize transition-colors", filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{f}</button>
              ))}
            </div>
          </div>
        </div>
        {clientId && !extClient && ideas.length > 0 && (
          <p className="text-[11px] font-body text-muted-foreground mb-2 -mt-1">Ative o Cria Post neste cliente (aba Posts) pra gerar o cronograma a partir das ideias.</p>
        )}

        {ideas.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl py-12 px-6 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-body text-foreground font-medium">Nenhuma ideia ainda</p>
            <p className="text-xs font-body text-muted-foreground mt-1">Rode uma análise acima pra gerar ideias.</p>
          </div>
        ) : filteredIdeas.length === 0 ? (
          <p className="text-sm font-body text-muted-foreground text-center py-8">Nenhuma ideia com esse status.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredIdeas.map((idea) => {
              const sm = STATUS_META[idea.status];
              return (
                <div key={idea.id} className="bg-card border border-border rounded-xl p-3.5 flex flex-col">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {idea.format && <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{idea.format}</span>}
                        <span className={cn("text-[10px] font-body px-1.5 py-0.5 rounded-full", sm.cls)}>{sm.label}</span>
                      </div>
                      <p className="text-sm font-body font-semibold text-foreground leading-snug">{idea.title}</p>
                      {idea.rationale && <p className="text-[12px] font-body text-muted-foreground mt-1 leading-relaxed">{idea.rationale}</p>}
                    </div>
                    <button onClick={() => del.mutate(idea.id)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-border/60">
                    <IdeaBtn active={idea.status === "usar"} onClick={() => upd.mutate({ id: idea.id, status: "usar" })} icon={<Check className="h-3 w-3" />}>Usar</IdeaBtn>
                    <IdeaBtn active={idea.status === "usada"} onClick={() => upd.mutate({ id: idea.id, status: "usada" })}>Usada</IdeaBtn>
                    <IdeaBtn active={idea.status === "descartada"} onClick={() => upd.mutate({ id: idea.id, status: "descartada" })} icon={<X className="h-3 w-3" />}>Descartar</IdeaBtn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

function SummaryCard({ summary, handle }: { summary: Record<string, unknown>; handle: string }) {
  const s = summary as Record<string, any>;
  const kind = s.kind;
  const KIND_LABEL: Record<string, string> = {
    profile: "Perfil", comments: "Comentários", ads: "Anúncios", stories: "Stories",
    posts: "Posts", reels: "Reels", hashtag: "Hashtag", mentions: "Menções", transcription: "Reels + transcrição",
  };
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-background">
        <Instagram className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-display font-bold text-foreground">{KIND_LABEL[kind] || "Análise"} · {handle}</h3>
      </div>
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
          <ListWrap title={`${fmtNum(s.count)} anúncios ativos — a oferta que ele paga pra promover`}>
            {Array.isArray(s.top) && s.top.slice(0, 10).map((a: any, i: number) => (
              <div key={i} className="rounded-lg border border-border/60 px-2.5 py-2">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  {a.active && <span className="text-[9px] font-body px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary">ativo</span>}
                  {a.page && <span className="text-[10px] font-body text-muted-foreground">{a.page}</span>}
                  {a.since && <span className="text-[10px] font-body text-muted-foreground">· desde {String(a.since).slice(0, 10)}</span>}
                </div>
                <p className="text-[12px] font-body text-foreground leading-snug">{a.text || "(sem texto)"}</p>
                {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="text-[11px] font-body text-primary hover:underline">ver anúncio →</a>}
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
          <ListWrap title={`${fmtNum(s.count)} comentários — as dúvidas viram pauta`}>
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
              <Stat label="Formatos" value={Object.keys(s.formats || {}).length ? `${Object.keys(s.formats).length} tipos` : "—"} />
            </div>
            {Array.isArray(s.top) && s.top.length > 0 && (
              <ListWrap title="Top posts (o que mais engajou)">
                {s.top.slice(0, 5).map((p: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border/60 px-2.5 py-2">
                    <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0 mt-0.5">{p.format}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-body text-foreground leading-snug line-clamp-2">{p.caption || "(sem legenda)"}</p>
                      {p.transcript && <p className="text-[11px] font-body text-muted-foreground/80 mt-0.5 line-clamp-2 italic">🎙 {p.transcript}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-body text-muted-foreground shrink-0">
                      <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{fmtNum(p.likes)}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{fmtNum(p.comments)}</span>
                      {p.views != null && <span className="flex items-center gap-0.5"><Play className="h-3 w-3" />{fmtNum(p.views)}</span>}
                    </div>
                  </div>
                ))}
              </ListWrap>
            )}
          </>
        )}
      </div>
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
  if (!Number.isFinite(v)) return "—";
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace(".0", "") + "M";
  if (v >= 1000) return (v / 1000).toFixed(1).replace(".0", "") + "k";
  return String(v);
}

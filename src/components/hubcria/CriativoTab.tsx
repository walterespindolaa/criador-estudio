import { useMemo, useState } from "react";
import { Loader2, Search, TrendingUp, Sparkles, Check, X, Trash2, Instagram, Heart, MessageCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useScrapes, useCreativeIdeas, useRunScrape, useUpdateIdeaStatus, useDeleteIdea,
  type ScrapeType, type CreativeIdea,
} from "@/hooks/useHubCria";

const TYPES: { key: ScrapeType; label: string }[] = [
  { key: "posts", label: "Posts" },
  { key: "reels", label: "Reels" },
  { key: "profile", label: "Perfil" },
  { key: "hashtag", label: "Hashtag" },
];

const STATUS_META: Record<CreativeIdea["status"], { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-muted text-muted-foreground" },
  usar: { label: "Usar", cls: "bg-primary/10 text-primary" },
  usada: { label: "Usada", cls: "bg-secondary/15 text-secondary" },
  descartada: { label: "Descartada", cls: "bg-destructive/10 text-destructive" },
};
const STATUS_FILTERS = ["todas", "novo", "usar", "usada", "descartada"] as const;

export function CriativoTab({ clientId }: { clientId: string; clientName?: string }) {
  const [type, setType] = useState<ScrapeType>("posts");
  const [handle, setHandle] = useState("");
  const [limit, setLimit] = useState(10);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("todas");

  const { data: scrapes = [] } = useScrapes(clientId);
  const { data: ideas = [] } = useCreativeIdeas(clientId);
  const run = useRunScrape();
  const upd = useUpdateIdeaStatus();
  const del = useDeleteIdea();

  const latest = scrapes.find((s) => s.status === "done");
  const analisar = () => {
    if (!handle.trim()) return;
    run.mutate({ type, input: handle.trim(), crm_client_id: clientId, limit });
  };

  const filteredIdeas = useMemo(
    () => (filter === "todas" ? ideas : ideas.filter((i) => i.status === filter)),
    [ideas, filter],
  );

  return (
    <div className="space-y-5">
      {/* Config */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-display font-bold text-foreground">Analisar concorrente</h3>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tipo</p>
            <div className="flex gap-1">
              {TYPES.map((t) => (
                <button key={t.key} onClick={() => setType(t.key)} className={cn("px-3 h-9 rounded-lg text-sm font-body border transition-colors", type === t.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{type === "hashtag" ? "Hashtag" : "@ do concorrente"}</p>
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={type === "hashtag" ? "esteticafacial" : "@concorrente"} className="h-9" onKeyDown={(e) => { if (e.key === "Enter") analisar(); }} />
          </div>
          {type !== "profile" && (
            <div>
              <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Qtd</p>
              <Input type="number" min={1} max={20} value={limit} onChange={(e) => setLimit(Math.max(1, Math.min(20, Number(e.target.value) || 10)))} className="h-9 w-20" />
            </div>
          )}
          <Button onClick={analisar} disabled={run.isPending || !handle.trim()} className="h-9">
            {run.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Analisar
          </Button>
        </div>
        <p className="text-[11px] font-body text-muted-foreground mt-2">
          Puxa dados reais do Instagram e gera ideias adaptadas ao nicho do cliente. Pode levar até ~1 min.
        </p>
      </div>

      {run.isPending && (
        <div className="border border-border rounded-2xl p-8 text-center bg-card">
          <Loader2 className="h-6 w-6 text-primary mx-auto animate-spin mb-2" />
          <p className="text-sm font-body text-foreground font-medium">Analisando @{handle.replace(/^@/, "")}…</p>
          <p className="text-xs font-body text-muted-foreground mt-1">Coletando posts e gerando ideias. Não feche a página.</p>
        </div>
      )}

      {/* Raio-x do concorrente */}
      {latest?.result_summary && <SummaryCard summary={latest.result_summary} handle={latest.input_handle} />}

      {/* Ideias */}
      <div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-display font-bold text-foreground">Ideias de conteúdo</h3>
          <div className="flex gap-1 ml-auto">
            {STATUS_FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("px-2.5 py-1 rounded-full text-xs font-body border capitalize transition-colors", filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{f}</button>
            ))}
          </div>
        </div>

        {ideas.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl py-12 px-6 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-body text-foreground font-medium">Nenhuma ideia ainda</p>
            <p className="text-xs font-body text-muted-foreground mt-1">Rode uma análise de concorrente acima pra gerar ideias.</p>
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

      {/* Histórico de análises */}
      {scrapes.length > 0 && (
        <div>
          <h3 className="text-sm font-display font-bold text-foreground mb-2">Análises feitas</h3>
          <div className="space-y-1.5">
            {scrapes.map((s) => (
              <div key={s.id} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-xs font-body">
                <Instagram className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground font-medium truncate">{s.input_handle}</span>
                <span className="text-muted-foreground capitalize">· {s.scrape_type}</span>
                <span className={cn("ml-auto shrink-0 px-1.5 py-0.5 rounded-full text-[10px]", s.status === "done" ? "bg-secondary/15 text-secondary" : s.status === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{s.status === "done" ? "pronto" : s.status === "error" ? "erro" : s.status}</span>
                <span className="text-muted-foreground shrink-0">{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const isProfile = s.kind === "profile";
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Instagram className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-display font-bold text-foreground">Raio-x de {handle}</h3>
      </div>

      {isProfile ? (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Seguidores" value={fmtNum(s.followers)} />
          <Stat label="Seguindo" value={fmtNum(s.following)} />
          <Stat label="Posts" value={fmtNum(s.posts)} />
          {s.biography && <p className="col-span-3 text-[13px] font-body text-muted-foreground mt-1 whitespace-pre-wrap">{s.biography}</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Stat label="Posts lidos" value={fmtNum(s.count)} />
            <Stat label="Média curtidas" value={fmtNum(s.avg_likes)} />
            <Stat label="Média coment." value={fmtNum(s.avg_comments)} />
            <Stat label="Formatos" value={Object.keys(s.formats || {}).length ? Object.keys(s.formats).length + " tipos" : "—"} />
          </div>
          {Array.isArray(s.top) && s.top.length > 0 && (
            <div>
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top posts (o que mais engajou)</p>
              <div className="space-y-1.5">
                {s.top.slice(0, 5).map((p: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 bg-muted/30 rounded-lg px-2.5 py-2">
                    <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0 mt-0.5">{p.format}</span>
                    <p className="text-[12px] font-body text-foreground flex-1 min-w-0 leading-snug line-clamp-2">{p.caption || "(sem legenda)"}</p>
                    <div className="flex items-center gap-2 text-[11px] font-body text-muted-foreground shrink-0">
                      <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{fmtNum(p.likes)}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{fmtNum(p.comments)}</span>
                      {p.views != null && <span className="flex items-center gap-0.5"><Play className="h-3 w-3" />{fmtNum(p.views)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-xl p-3">
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

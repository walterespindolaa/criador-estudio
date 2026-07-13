import { useState } from "react";
import { Lightbulb, Bookmark, Sparkles, Plus, Trash2, ExternalLink, Instagram, Loader2 } from "lucide-react";
import { useCriaClientIdeas, useCrmSavedRefs, useAddCrmSavedRef, useDeleteCrmSavedRef } from "@/hooks/useBancoIdeias";
import { useCreativeIdeas, useUpdateIdeaStatus, useDeleteIdea } from "@/hooks/useHubCria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════
// BANCO DE IDEIAS DO CLIENTE
//
// Antes as ideias moravam misturadas com a pesquisa do Apify, a pessoa
// abria "Criativo" e não sabia se aquilo era do cliente, do HUB, ou dela.
//
// Agora são quatro origens, cada uma com o seu lugar e o seu rótulo:
//   • Do cliente   → ideias que ELE escreveu na conta CRIA dele
//   • Salvos dele  → posts que ELE guardou como referência
//   • Do HUB       → ideias que a IA gerou a partir dos concorrentes
//   • Suas         → links que VOCÊ salva, só você vê
// ═══════════════════════════════════════════════════════════════════════

type Fonte = "cliente" | "salvos-cliente" | "hub" | "meus";

const ABAS: { key: Fonte; label: string; icon: typeof Lightbulb; hint: string }[] = [
  { key: "cliente", label: "Do cliente", icon: Lightbulb, hint: "Ideias que o próprio cliente escreveu na conta CRIA dele. Ele pensa, você executa." },
  { key: "salvos-cliente", label: "Salvos dele", icon: Bookmark, hint: "Posts que o cliente guardou como referência. É o gosto dele, em imagem." },
  { key: "hub", label: "Do HUB", icon: Sparkles, hint: "Ideias que a IA gerou a partir da análise dos concorrentes dele." },
  { key: "meus", label: "Seus salvos", icon: Instagram, hint: "Links que você guarda pra este cliente. Só você vê, nem ele, nem a equipe do lado dele." },
];

export function ClienteIdeias({ clientId, criaOwnerId }: { clientId: string; criaOwnerId: string | null }) {
  const [aba, setAba] = useState<Fonte>(criaOwnerId ? "cliente" : "hub");

  const { data: doCria, isLoading: loadingCria } = useCriaClientIdeas(criaOwnerId);
  const { data: meusRefs = [], isLoading: loadingRefs } = useCrmSavedRefs(clientId);
  const { data: hubIdeas = [], isLoading: loadingHub } = useCreativeIdeas(clientId);

  const addRef = useAddCrmSavedRef();
  const delRef = useDeleteCrmSavedRef();
  const setStatus = useUpdateIdeaStatus();
  const delIdea = useDeleteIdea();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const abaAtual = ABAS.find((a) => a.key === aba)!;
  const semCria = !criaOwnerId;

  const contagem: Record<Fonte, number> = {
    cliente: doCria?.ideas.length ?? 0,
    "salvos-cliente": doCria?.saved.length ?? 0,
    hub: hubIdeas.length,
    meus: meusRefs.length,
  };

  const salvar = () => {
    if (!url.trim()) return;
    addRef.mutate(
      { crm_client_id: clientId, url, title, note },
      { onSuccess: () => { setUrl(""); setTitle(""); setNote(""); } },
    );
  };

  return (
    <div className="space-y-4">
      {/* Explicação, didática de propósito. */}
      <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3">
        <p className="text-[13px] font-body text-foreground/85 leading-relaxed">
          Tudo que inspira este cliente, num lugar só. O que <strong>ele</strong> pensou, o que <strong>ele</strong> salvou,
          o que a <strong>IA</strong> tirou dos concorrentes e o que <strong>você</strong> guardou.
        </p>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1.5 flex-wrap">
        {ABAS.map((a) => {
          const Icon = a.icon;
          const off = semCria && (a.key === "cliente" || a.key === "salvos-cliente");
          return (
            <button key={a.key} onClick={() => !off && setAba(a.key)} disabled={off}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-body font-semibold border transition-colors",
                aba === a.key ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground",
                off && "opacity-40 cursor-not-allowed",
              )}>
              <Icon className="h-3.5 w-3.5" /> {a.label}
              <span className="text-[11px] opacity-70">{contagem[a.key]}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[12px] font-body text-muted-foreground -mt-1">{abaAtual.hint}</p>

      {semCria && (aba === "cliente" || aba === "salvos-cliente") && (
        <Vazio titulo="Este cliente não usa o Cria" texto="As ideias e os salvos dele só aparecem aqui quando ele tem conta no Cria." />
      )}

      {/* ── IDEIAS DO CLIENTE ── */}
      {aba === "cliente" && !semCria && (
        loadingCria ? <Carregando /> :
        (doCria?.ideas.length ?? 0) === 0 ? (
          <Vazio titulo="Nenhuma ideia ainda" texto="Quando o cliente anotar uma ideia na conta dele, ela aparece aqui na hora." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {doCria!.ideas.map((i) => (
              <div key={i.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  {i.platform && <Chip>{i.platform}</Chip>}
                  {i.objective && <Chip>{i.objective}</Chip>}
                  {i.status && <Chip tone="muted">{i.status}</Chip>}
                </div>
                <p className="text-sm font-display font-bold text-foreground">{i.title}</p>
                {i.notes && <p className="text-[12.5px] font-body text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">{i.notes}</p>}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── SALVOS DO CLIENTE ── */}
      {aba === "salvos-cliente" && !semCria && (
        loadingCria ? <Carregando /> :
        (doCria?.saved.length ?? 0) === 0 ? (
          <Vazio titulo="Nada salvo ainda" texto="Os posts que o cliente guardar como referência na conta dele aparecem aqui." />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {doCria!.saved.map((s) => (
              <RefCard key={s.id} url={s.url} thumb={s.thumbnail_url} title={s.caption} author={s.author} note={s.note} />
            ))}
          </div>
        )
      )}

      {/* ── IDEIAS DO HUB ── */}
      {aba === "hub" && (
        loadingHub ? <Carregando /> :
        hubIdeas.length === 0 ? (
          <Vazio titulo="Nenhuma ideia do HUB" texto="Rode uma análise de concorrente na aba Pesquisa, cada análise gera ideias pra este cliente." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hubIdeas.map((i) => (
              <div key={i.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {i.format && <Chip>{i.format}</Chip>}
                    <Chip tone={i.status === "usar" ? "ok" : "muted"}>{i.status ?? "novo"}</Chip>
                  </div>
                  <button onClick={() => delIdea.mutate(i.id)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm font-display font-bold text-foreground mt-1.5">{i.title}</p>
                {i.rationale && <p className="text-[12.5px] font-body text-muted-foreground mt-1 leading-relaxed">{i.rationale}</p>}
                <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-border/60">
                  {(["usar", "usada", "descartada"] as const).map((s) => (
                    <Button key={s} size="sm" variant={i.status === s ? "default" : "outline"} className="h-7 text-[11px]"
                      onClick={() => setStatus.mutate({ id: i.id, status: s })}>
                      {s === "usar" ? "Usar" : s === "usada" ? "Usada" : "Descartar"}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── SEUS SALVOS ── */}
      {aba === "meus" && (
        <>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-display font-bold text-foreground mb-1">Guardar uma referência</p>
            <p className="text-[12px] font-body text-muted-foreground mb-3">
              Cole o link de um post do Instagram que te inspirou pra este cliente. Fica só pra você.
            </p>
            <div className="space-y-2">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/p/…" className="rounded-xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)" className="rounded-xl" />
                <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Por que salvou? (opcional)" className="rounded-xl text-sm" />
              </div>
              <Button onClick={salvar} disabled={!url.trim() || addRef.isPending} className="w-full sm:w-auto">
                {addRef.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />} Salvar referência
              </Button>
            </div>
          </div>

          {loadingRefs ? <Carregando /> :
            meusRefs.length === 0 ? (
              <Vazio titulo="Você ainda não salvou nada" texto="Vá guardando os posts que te inspiram pra este cliente, vira o seu banco particular." />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {meusRefs.map((r) => (
                  <RefCard key={r.id} url={r.url} thumb={r.thumbnail_url} title={r.title} author={r.author} note={r.note}
                    onDelete={() => { if (confirm("Excluir esta referência?")) delRef.mutate(r.id); }} />
                ))}
              </div>
            )}
        </>
      )}
    </div>
  );
}

function RefCard({ url, thumb, title, author, note, onDelete }: {
  url: string; thumb?: string | null; title?: string | null; author?: string | null; note?: string | null; onDelete?: () => void;
}) {
  return (
    <div className="group relative rounded-2xl border border-border bg-card overflow-hidden">
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* referrerPolicy="no-referrer" é OBRIGATÓRIO aqui.
            O CDN do Instagram recusa a imagem quando o navegador manda o Referer
            de outro domínio (anti-hotlink). No desktop às vezes passa; no Safari
            do iPhone ele bloqueia sempre, e a imagem vira o "?" quebrado do print.
            Sem o Referer, o CDN serve normalmente.
            O ícone fica ATRÁS: se a imagem carrega, ela cobre. Se falhar, o onError
            some com a <img> e sobra o ícone, em vez do quadrado de imagem quebrada. */}
        <div className="relative aspect-square bg-muted overflow-hidden">
          <span className="absolute inset-0 grid place-items-center">
            <Instagram className="h-6 w-6 text-muted-foreground/40" />
          </span>
          {thumb && (
            <img
              src={thumb}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              className="relative w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          )}
        </div>
        <div className="p-3">
          {author && <p className="text-[11px] font-body text-muted-foreground truncate">@{author.replace(/^@/, "")}</p>}
          {title && <p className="text-[12.5px] font-body text-foreground line-clamp-2 leading-snug">{title}</p>}
          {note && <p className="text-[11px] font-body text-muted-foreground mt-1 line-clamp-2 italic">{note}</p>}
          <span className="inline-flex items-center gap-1 text-[11px] font-body font-semibold text-primary mt-1.5">
            <ExternalLink className="h-3 w-3" /> abrir no Instagram
          </span>
        </div>
      </a>
      {onDelete && (
        <button onClick={onDelete}
          className="absolute top-2 right-2 h-7 w-7 grid place-items-center rounded-lg bg-background/90 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Excluir referência">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Chip({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "muted" | "ok" }) {
  return (
    <span className={cn("text-[10px] font-body font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
      tone === "ok" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/25"
        : tone === "muted" ? "bg-muted text-muted-foreground border-border"
        : "bg-primary/10 text-primary border-primary/20")}>
      {children}
    </span>
  );
}

function Carregando() {
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div>;
}

function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="text-sm font-body text-foreground font-medium">{titulo}</p>
      <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">{texto}</p>
    </div>
  );
}

export default ClienteIdeias;

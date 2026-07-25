import { useState, useMemo, useEffect } from "react";
import { Lightbulb, Bookmark, Sparkles, Plus, Trash2, ExternalLink, Instagram, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useCriaClientIdeas, useCrmSavedRefs, useAddCrmSavedRef, useDeleteCrmSavedRef } from "@/hooks/useBancoIdeias";
import { useCreativeIdeas, useUpdateIdeaStatus, useDeleteIdea } from "@/hooks/useHubCria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/shared/Confirm";

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

// Paginação: ~10 linhas por página. No desktop o grid tem 6 colunas,
// então 6 x 10 = 60 itens por página. Espelha o padrão do SavedRefs.
const PAGE_SIZE = 60;

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

  // Filtro por pasta + paginação da aba "Salvos dele" (posts que o cliente guardou).
  const [savedFolder, setSavedFolder] = useState<string | null>(null);
  const [savedPage, setSavedPage] = useState(1);
  // Paginação da aba "Seus salvos" (os salvos privados da social mídia; sem pasta).
  const [meusPage, setMeusPage] = useState(1);

  // Pastas reais dos salvos DESTE cliente, na ordem alfabética.
  const savedFolders = useMemo(() => {
    const set = new Set<string>();
    (doCria?.saved ?? []).forEach((s) => { const f = s.folder?.trim(); if (f) set.add(f); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [doCria]);

  // Lista de "Salvos dele" já filtrada pela pasta ativa.
  const savedFiltered = useMemo(() => {
    const list = doCria?.saved ?? [];
    if (!savedFolder) return list;
    return list.filter((s) => (s.folder ?? "").trim() === savedFolder);
  }, [doCria, savedFolder]);

  const savedTotalPages = Math.max(1, Math.ceil(savedFiltered.length / PAGE_SIZE));
  // Troca de pasta/aba volta pra página 1; e reajusta se a página passou do total.
  useEffect(() => { setSavedPage(1); }, [savedFolder, aba]);
  useEffect(() => { if (savedPage > savedTotalPages) setSavedPage(savedTotalPages); }, [savedPage, savedTotalPages]);
  const savedPaged = useMemo(() => savedFiltered.slice((savedPage - 1) * PAGE_SIZE, savedPage * PAGE_SIZE), [savedFiltered, savedPage]);

  // "Seus salvos" não tem pasta, mas também pagina pra não explodir a lista.
  const meusTotalPages = Math.max(1, Math.ceil(meusRefs.length / PAGE_SIZE));
  useEffect(() => { if (meusPage > meusTotalPages) setMeusPage(meusTotalPages); }, [meusPage, meusTotalPages]);
  const meusPaged = useMemo(() => meusRefs.slice((meusPage - 1) * PAGE_SIZE, meusPage * PAGE_SIZE), [meusRefs, meusPage]);

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
          <div className="space-y-3">
            {/* Pastas reais do cliente: filtram a lista ao clicar. */}
            {savedFolders.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <FolderChip active={!savedFolder} onClick={() => setSavedFolder(null)}>Todas</FolderChip>
                {savedFolders.map((f) => (
                  <FolderChip key={f} active={savedFolder === f} onClick={() => setSavedFolder(savedFolder === f ? null : f)}>{f}</FolderChip>
                ))}
              </div>
            )}
            {savedFiltered.length === 0 ? (
              <Vazio titulo="Nada nesta pasta" texto="Escolha outra pasta ou volte pra Todas." />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {savedPaged.map((s) => (
                    <RefCard key={s.id} url={s.url} thumb={s.thumbnail_url} title={s.caption} author={s.author} note={s.note} folder={s.folder} />
                  ))}
                </div>
                <Paginacao page={savedPage} totalPages={savedTotalPages} onChange={setSavedPage} />
              </>
            )}
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
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {meusPaged.map((r) => (
                    <RefCard key={r.id} url={r.url} thumb={r.thumbnail_url} title={r.title} author={r.author} note={r.note}
                      onDelete={async () => { if (await confirmar({ titulo: "Excluir esta referência?" })) delRef.mutate(r.id); }} />
                  ))}
                </div>
                <Paginacao page={meusPage} totalPages={meusTotalPages} onChange={setMeusPage} />
              </>
            )}
        </>
      )}
    </div>
  );
}

function RefCard({ url, thumb, title, author, note, folder, onDelete }: {
  url: string; thumb?: string | null; title?: string | null; author?: string | null; note?: string | null; folder?: string | null; onDelete?: () => void;
}) {
  return (
    <div className="group relative rounded-xl border border-border bg-card overflow-hidden">
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* referrerPolicy="no-referrer" é OBRIGATÓRIO aqui.
            O CDN do Instagram recusa a imagem quando o navegador manda o Referer
            de outro domínio (anti-hotlink). No desktop às vezes passa; no Safari
            do iPhone ele bloqueia sempre, e a imagem vira o "?" quebrado do print.
            Sem o Referer, o CDN serve normalmente.
            O ícone fica ATRÁS: se a imagem carrega, ela cobre. Se falhar, o onError
            some com a <img> e sobra o ícone, em vez do quadrado de imagem quebrada. */}
        <div className="relative aspect-[4/5] bg-muted overflow-hidden">
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
        {/* Mobile (2 col): textos maiores pra ler; a partir de sm o grid aperta e encolhe. */}
        <div className="p-2 sm:p-1.5">
          {author && <p className="text-xs sm:text-[10px] font-body font-semibold text-foreground truncate">@{author.replace(/^@/, "")}</p>}
          {title && <p className="text-[11px] sm:text-[9.5px] font-body text-muted-foreground line-clamp-2 mt-0.5 leading-snug">{title}</p>}
          {note && <p className="text-[10px] sm:text-[9px] font-body text-muted-foreground mt-0.5 line-clamp-1 italic">{note}</p>}
          {folder && <span className="inline-block mt-1 text-[9px] sm:text-[8px] font-body px-1.5 py-0.5 rounded-full bg-primary/10 text-primary truncate max-w-full">{folder}</span>}
          <span className="flex items-center gap-1 text-[10px] sm:text-[9px] font-body font-semibold text-primary mt-1">
            <ExternalLink className="h-3 w-3 sm:h-2.5 sm:w-2.5" /> abrir no Instagram
          </span>
        </div>
      </a>
      {onDelete && (
        <button onClick={onDelete}
          className="absolute top-1.5 right-1.5 h-7 w-7 grid place-items-center rounded-lg bg-background/90 text-muted-foreground hover:text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          aria-label="Excluir referência">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// Chip de pasta: espelha o visual dos chips do SavedRefs.
function FolderChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("px-3 h-8 rounded-full text-xs font-body border",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>
      {children}
    </button>
  );
}

// Controles de página: só aparecem quando há mais de uma página.
function Paginacao({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>
        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
      </Button>
      <span className="text-xs font-body text-muted-foreground">Página {page} de {totalPages}</span>
      <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page >= totalPages} onClick={() => onChange(Math.min(totalPages, page + 1))}>
        Próxima <ChevronRight className="h-3.5 w-3.5 ml-1" />
      </Button>
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

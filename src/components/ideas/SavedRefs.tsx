import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Plus, Loader2, Search, Play, MoreVertical, Trash2, FolderInput, ExternalLink, PenLine, Instagram, Music2, ImageOff, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSavedRefs, useSavedFolders, useAddSavedRef, useUpdateSavedRef, useDeleteSavedRef, useRefreshSavedCover, useRecoverMissingCovers, type SavedRef } from "@/hooks/useSavedRefs";
import { usePosts } from "@/hooks/usePosts";

// Sentinelas do seletor de pasta (não colidem com nomes reais de pasta).
const FOLDER_NONE = "__none__";
const FOLDER_NEW = "__new__";

// Paginação: ~10 linhas por página. No desktop o grid tem 6 colunas,
// então 6 x 10 = 60 itens por página mantém a ideia de "10 linhas".
const PAGE_SIZE = 60;

export function SavedRefs({ initialUrl }: { initialUrl?: string }) {
  const navigate = useNavigate();
  const { data: refs = [], isLoading } = useSavedRefs();
  const folders = useSavedFolders();
  const add = useAddSavedRef();
  const upd = useUpdateSavedRef();
  const del = useDeleteSavedRef();
  const refreshCover = useRefreshSavedCover();
  const recoverCovers = useRecoverMissingCovers();
  const { createPost } = usePosts();

  // Salvos SEM capa (thumbnail vazio/null): só esses entram no lote.
  const missingCovers = useMemo(() => refs.filter((r) => !r.thumbnail_url).map((r) => ({ id: r.id, url: r.url })), [refs]);

  const [url, setUrl] = useState(initialUrl ?? "");
  // Seletor de pasta: valor do select (sentinela "sem pasta"/"nova pasta" ou nome existente)
  // + texto da pasta nova. O valor final vira o mesmo campo "folder" do save().
  const [folderSel, setFolderSel] = useState<string>(FOLDER_NONE);
  const [newFolder, setNewFolder] = useState("");
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return refs.filter((r) => {
      if (activeFolder && (r.folder ?? "") !== activeFolder) return false;
      if (!q) return true;
      return (r.author ?? "").toLowerCase().includes(q) || (r.caption ?? "").toLowerCase().includes(q) || (r.folder ?? "").toLowerCase().includes(q);
    });
  }, [refs, search, activeFolder]);

  // Paginação client-side sobre a lista JÁ filtrada (busca + pasta).
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Ao mudar busca/pasta (ou a lista encolher), volta pra página 1.
  useEffect(() => { setPage(1); }, [search, activeFolder]);
  // Segurança: se a página atual passou do total (ex.: itens excluídos), reajusta.
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  // Resolve a pasta escolhida: existente selecionada, nova digitada ou nenhuma.
  const resolveFolder = () => {
    if (folders.length === 0) return newFolder.trim();
    if (folderSel === FOLDER_NEW) return newFolder.trim();
    if (folderSel === FOLDER_NONE) return "";
    return folderSel;
  };

  const save = () => {
    if (!url.trim()) return;
    add.mutate({ url: url.trim(), folder: resolveFolder() || null }, { onSuccess: () => { setUrl(""); } });
  };

  const move = (r: SavedRef) => {
    setMenuId(null);
    const f = window.prompt("Mover para qual pasta?", r.folder ?? "");
    if (f === null) return;
    upd.mutate({ id: r.id, patch: { folder: f.trim() || null } });
  };

  const criarPost = async (r: SavedRef) => {
    setMenuId(null);
    try {
      const title = (r.caption?.split("\n")[0] || `Post inspirado em @${r.author || "referência"}`).slice(0, 120);
      const post = await createPost.mutateAsync({
        title,
        platform: r.platform === "tiktok" ? "tiktok" : "instagram",
        format: r.media_type === "video" ? "reels" : r.media_type === "carousel" ? "carrossel" : "foto",
        status: "ideia",
        notes: `Referência salva: ${r.url}${r.caption ? `\n\nLegenda original:\n${r.caption.slice(0, 500)}` : ""}`,
      } as never);
      const newId = (post as { id?: string })?.id ?? null;
      upd.mutate({ id: r.id, patch: { status: "usado", used_post_id: newId } });
      toast.success("Post criado no Criando a partir do salvo.");
      navigate("/app/criando");
    } catch { toast.error("Não consegui criar o post."); }
  };

  return (
    <div className="space-y-4">
      {/* Adicionar */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          <p className="text-sm font-display font-bold text-foreground">Salvar um link</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} placeholder="Cole o link do Instagram ou TikTok…" className="flex-1" />
          <Button onClick={save} disabled={add.isPending || !url.trim()} className="shrink-0">
            {add.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
        {/* Seletor de pasta: escolhe uma existente ou cria uma nova (opcional). */}
        <div className="flex flex-col sm:flex-row gap-2">
          {folders.length > 0 && (
            <Select value={folderSel} onValueChange={setFolderSel}>
              <SelectTrigger className="w-full sm:w-52 h-9">
                <span className="text-muted-foreground mr-1 text-xs shrink-0">Pasta:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FOLDER_NONE}>Sem pasta</SelectItem>
                {folders.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                <SelectItem value={FOLDER_NEW}>+ Nova pasta…</SelectItem>
              </SelectContent>
            </Select>
          )}
          {(folders.length === 0 || folderSel === FOLDER_NEW) && (
            <Input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} placeholder="Pasta (ex.: Ganchos)" className="w-full sm:w-52 h-9" autoFocus={folders.length > 0 && folderSel === FOLDER_NEW} />
          )}
        </div>
        <p className="text-[11px] font-body text-muted-foreground">Puxa a capa e a legenda do post automaticamente. Depois é só categorizar e usar como referência.</p>
      </div>

      {/* Busca + pastas */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por @ ou palavra…" className="pl-9" />
        </div>
        {/* Recuperar capas faltantes EM LOTE: só aparece se houver salvos sem capa. */}
        {missingCovers.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => recoverCovers.recover(missingCovers)}
              disabled={recoverCovers.running}
            >
              {recoverCovers.running ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              {recoverCovers.running
                ? `Recuperando capas… ${recoverCovers.progress.done} de ${recoverCovers.progress.total}`
                : `Recuperar capas faltantes (${missingCovers.length})`}
            </Button>
            {recoverCovers.running && (
              <button onClick={recoverCovers.cancel} className="text-[11px] font-body text-muted-foreground hover:text-foreground underline shrink-0">
                cancelar
              </button>
            )}
          </div>
        )}
        {folders.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setActiveFolder(null)} className={cn("px-3 h-8 rounded-full text-xs font-body border", !activeFolder ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>Todas</button>
            {folders.map((f) => (
              <button key={f} onClick={() => setActiveFolder(activeFolder === f ? null : f)} className={cn("px-3 h-8 rounded-full text-xs font-body border", activeFolder === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>{f}</button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl py-14 text-center">
          <Bookmark className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm font-body text-foreground font-medium">{refs.length === 0 ? "Nenhum salvo ainda" : "Nada nesse filtro"}</p>
          <p className="text-xs font-body text-muted-foreground mt-1">{refs.length === 0 ? "Cole um link do Instagram/TikTok acima." : "Tenta outra pasta ou busca."}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {paged.map((r) => (
              <SavedCard key={r.id} r={r} open={menuId === r.id} onToggleMenu={() => setMenuId(menuId === r.id ? null : r.id)}
                onOpen={() => window.open(r.url, "_blank", "noopener")}
                onCriar={() => criarPost(r)} onMove={() => move(r)} onDelete={() => { setMenuId(null); del.mutate(r.id); }}
                onRefreshCover={() => refreshCover.mutate({ id: r.id, url: r.url })}
                refreshing={refreshCover.isPending && refreshCover.variables?.id === r.id}
                loadingCover={add.pendingPreviewIds.has(r.id)} />
            ))}
          </div>
          {/* Controles de página: só quando há mais de uma página. */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
              </Button>
              <span className="text-xs font-body text-muted-foreground">Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Próxima <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SavedCard({ r, open, onToggleMenu, onOpen, onCriar, onMove, onDelete, onRefreshCover, refreshing, loadingCover }: {
  r: SavedRef; open: boolean; onToggleMenu: () => void; onOpen: () => void; onCriar: () => void; onMove: () => void; onDelete: () => void;
  onRefreshCover: () => void; refreshing: boolean; loadingCover: boolean;
}) {
  const pressTimer = useRef<number | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const startPress = () => { pressTimer.current = window.setTimeout(() => onToggleMenu(), 500); };
  const cancelPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };
  const PlatIcon = r.platform === "tiktok" ? Music2 : Instagram;
  // Sem capa OU capa quebrou (URL de CDN expirada): mostra placeholder decente.
  const showPlaceholder = !r.thumbnail_url || imgFailed;
  return (
    <div className="relative rounded-xl border border-border bg-card overflow-hidden group"
      onTouchStart={startPress} onTouchEnd={cancelPress} onTouchMove={cancelPress}>
      <button onClick={onOpen} className="block w-full text-left">
        <div className="aspect-[4/5] bg-muted relative">
          {!showPlaceholder ? (
            <img src={r.thumbnail_url!} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" onError={() => setImgFailed(true)} />
          ) : loadingCover ? (
            // Capa vindo em segundo plano: shimmer discreto pra a pessoa saber que está carregando.
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-muted to-muted/60 animate-pulse">
              <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
                <span className="text-[8px] font-body">puxando capa…</span>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-muted to-muted/60">
              <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
                <PlatIcon className="h-7 w-7" strokeWidth={1.5} />
                <span className="text-[8px] font-body inline-flex items-center gap-1"><ImageOff className="h-2.5 w-2.5" /> sem capa</span>
              </div>
            </div>
          )}
          {r.media_type === "video" && (
            <span className="absolute top-1.5 left-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white"><Play className="h-3 w-3" /></span>
          )}
          {r.status === "usado" && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-secondary/90 text-white text-[8px] font-bold px-1.5 py-0.5">usado</span>}
          <span className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/40 text-white"><PlatIcon className="h-2.5 w-2.5" /></span>
        </div>
      </button>
      <div className="p-1.5">
        {r.author && <p className="text-[10px] font-body font-semibold text-foreground truncate">@{r.author}</p>}
        {r.caption && <p className="text-[9.5px] font-body text-muted-foreground line-clamp-2 mt-0.5 leading-snug">{r.caption}</p>}
        {r.folder && <span className="inline-block mt-1 text-[8px] font-body px-1.5 py-0.5 rounded-full bg-primary/10 text-primary truncate max-w-full">{r.folder}</span>}
      </div>
      {/* Ações visíveis abaixo do post */}
      <div className="px-1.5 pb-1.5 space-y-1">
        <Button size="sm" className="w-full h-7 text-[10px] px-1" onClick={onCriar}>
          <PenLine className="h-3 w-3 mr-1" /> Criar post
        </Button>
        <div className="flex items-center gap-1">
          <button onClick={onOpen} title="Abrir original" className="flex-1 h-6 grid place-items-center rounded-md bg-muted/60 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /></button>
          <button onClick={onRefreshCover} disabled={refreshing} title="Atualizar capa" className="flex-1 h-6 grid place-items-center rounded-md bg-muted/60 text-muted-foreground hover:text-foreground disabled:opacity-50"><RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} /></button>
          <button onClick={onMove} title="Mover de pasta" className="flex-1 h-6 grid place-items-center rounded-md bg-muted/60 text-muted-foreground hover:text-foreground"><FolderInput className="h-3 w-3" /></button>
          <button onClick={onDelete} title="Excluir" className="flex-1 h-6 grid place-items-center rounded-md bg-muted/60 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
    </div>
  );
}

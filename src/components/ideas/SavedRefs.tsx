import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Plus, Loader2, Search, Play, MoreVertical, Trash2, FolderInput, ExternalLink, PenLine, Instagram, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSavedRefs, useSavedFolders, useAddSavedRef, useUpdateSavedRef, useDeleteSavedRef, type SavedRef } from "@/hooks/useSavedRefs";
import { usePosts } from "@/hooks/usePosts";

export function SavedRefs({ initialUrl }: { initialUrl?: string }) {
  const navigate = useNavigate();
  const { data: refs = [], isLoading } = useSavedRefs();
  const folders = useSavedFolders();
  const add = useAddSavedRef();
  const upd = useUpdateSavedRef();
  const del = useDeleteSavedRef();
  const { createPost } = usePosts();

  const [url, setUrl] = useState(initialUrl ?? "");
  const [folder, setFolder] = useState("");
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return refs.filter((r) => {
      if (activeFolder && (r.folder ?? "") !== activeFolder) return false;
      if (!q) return true;
      return (r.author ?? "").toLowerCase().includes(q) || (r.caption ?? "").toLowerCase().includes(q) || (r.folder ?? "").toLowerCase().includes(q);
    });
  }, [refs, search, activeFolder]);

  const save = () => {
    if (!url.trim()) return;
    add.mutate({ url: url.trim(), folder: folder.trim() || null, withPreview: true }, { onSuccess: () => { setUrl(""); } });
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
          <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Pasta (ex.: Ganchos)" className="sm:w-44" list="saved-folders" />
          <datalist id="saved-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
          <Button onClick={save} disabled={add.isPending || !url.trim()} className="shrink-0">
            {add.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <p className="text-[11px] font-body text-muted-foreground">Puxa a capa e a legenda do post automaticamente. Depois é só categorizar e usar como referência.</p>
      </div>

      {/* Busca + pastas */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por @ ou palavra…" className="pl-9" />
        </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((r) => (
            <SavedCard key={r.id} r={r} open={menuId === r.id} onToggleMenu={() => setMenuId(menuId === r.id ? null : r.id)}
              onOpen={() => window.open(r.url, "_blank", "noopener")}
              onCriar={() => criarPost(r)} onMove={() => move(r)} onDelete={() => { setMenuId(null); del.mutate(r.id); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedCard({ r, open, onToggleMenu, onOpen, onCriar, onMove, onDelete }: {
  r: SavedRef; open: boolean; onToggleMenu: () => void; onOpen: () => void; onCriar: () => void; onMove: () => void; onDelete: () => void;
}) {
  const pressTimer = useRef<number | null>(null);
  const startPress = () => { pressTimer.current = window.setTimeout(() => onToggleMenu(), 500); };
  const cancelPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };
  const PlatIcon = r.platform === "tiktok" ? Music2 : Instagram;
  return (
    <div className="relative rounded-2xl border border-border bg-card overflow-hidden group"
      onTouchStart={startPress} onTouchEnd={cancelPress} onTouchMove={cancelPress}>
      <button onClick={onOpen} className="block w-full text-left">
        <div className="aspect-[4/5] bg-muted relative">
          {r.thumbnail_url ? (
            <img src={r.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground/40"><PlatIcon className="h-8 w-8" /></div>
          )}
          {r.media_type === "video" && (
            <span className="absolute top-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-black/45 text-white"><Play className="h-3.5 w-3.5" /></span>
          )}
          {r.status === "usado" && <span className="absolute bottom-2 left-2 rounded-full bg-secondary/90 text-white text-[9px] font-bold px-1.5 py-0.5">usado</span>}
          <span className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-white"><PlatIcon className="h-3 w-3" /></span>
        </div>
      </button>
      <div className="p-2">
        {r.author && <p className="text-[11px] font-body font-semibold text-foreground truncate">@{r.author}</p>}
        {r.caption && <p className="text-[10.5px] font-body text-muted-foreground line-clamp-2 mt-0.5">{r.caption}</p>}
        {r.folder && <span className="inline-block mt-1 text-[9px] font-body px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{r.folder}</span>}
      </div>
      <button onClick={onToggleMenu} className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/35 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Opções">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggleMenu} />
          <div className="absolute z-20 top-9 right-2 w-44 rounded-xl border border-border bg-card shadow-warm-lg overflow-hidden">
            <button onClick={onCriar} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-body text-foreground hover:bg-muted/60 text-left"><PenLine className="h-4 w-4 text-primary" /> Criar post disso</button>
            <button onClick={onOpen} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-body text-foreground hover:bg-muted/60 text-left"><ExternalLink className="h-4 w-4" /> Abrir original</button>
            <button onClick={onMove} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-body text-foreground hover:bg-muted/60 text-left"><FolderInput className="h-4 w-4" /> Mover de pasta</button>
            <button onClick={onDelete} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-body text-destructive hover:bg-destructive/10 text-left"><Trash2 className="h-4 w-4" /> Excluir</button>
          </div>
        </>
      )}
    </div>
  );
}

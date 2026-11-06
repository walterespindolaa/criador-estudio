import { useMemo } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/constants";
import type { Post } from "@/hooks/usePosts";
import { parseDateOnly } from "@/lib/date-br";

/* LISTA "PRA MONTAR O FEED" (Walter, 06/11/2026, mockup aprovado): compacta,
   miniatura pequena, título numa linha, formato e situação. O filtro passa a
   ser por mídia (o que importa pra montar a grade), e o + manda pra grade. */

export const SIDEBAR_DROPPABLE_ID = "feed-sidebar";

/** Filtro por situação, usado pela gaveta de adicionar do celular. */
export type StatusFilter = "todos" | "editando" | "agendado" | "publicado";
/** Filtro da lista lateral: pela mídia. */
export type FiltroMidia = "todos" | "commidia" | "semmidia";

const FILTROS: { key: FiltroMidia; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "commidia", label: "Com mídia" },
  { key: "semmidia", label: "Sem mídia" },
];

type Props = {
  posts: Post[];
  thumbnails: Record<string, string | null>;
  filtro: FiltroMidia;
  onFiltro: (f: FiltroMidia) => void;
  searchFilter: string;
  onSearchFilterChange: (q: string) => void;
  onAdd?: (postId: string) => void;
};

export function situacaoDoPost(p: Post): string {
  if (p.status === "publicado") return "publicado";
  if (p.status === "agendado" && p.scheduled_date) {
    const d = parseDateOnly(p.scheduled_date);
    return `agendado ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (p.status === "agendado") return "agendado";
  return "em produção";
}

export function FeedSidebar({ posts, thumbnails, filtro, onFiltro, searchFilter, onSearchFilterChange, onAdd }: Props) {
  const filteredPosts = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return posts.filter((p) => {
      const tem = !!thumbnails[p.id];
      if (filtro === "commidia" && !tem) return false;
      if (filtro === "semmidia" && tem) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, filtro, searchFilter, thumbnails]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchFilter}
            onChange={(e) => onSearchFilterChange(e.target.value)}
            placeholder="Buscar post"
            className="h-9 w-full rounded-full border-2 border-foreground bg-card pl-8 pr-3 text-sm font-body outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filtro === f.key}
              onClick={() => onFiltro(f.key)}
              className={cn(
                "px-3 py-1 rounded-full text-[12px] font-body font-bold border-2 transition-colors",
                filtro === f.key ? "bg-foreground text-background border-foreground" : "bg-card border-foreground text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Droppable droppableId={SIDEBAR_DROPPABLE_ID}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn("flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 space-y-2 transition-colors", snapshot.isDraggingOver && "bg-primary/5")}
          >
            {filteredPosts.length === 0 && (
              <div className="text-center py-8 px-3">
                <p className="text-xs font-body text-muted-foreground">Nenhum post com esse filtro.</p>
              </div>
            )}

            {filteredPosts.map((post, index) => {
              const thumb = thumbnails[post.id] ?? null;
              return (
                <Draggable key={post.id} draggableId={`sidebar-${post.id}`} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={cn(
                        "flex items-center gap-2.5 p-1.5 pr-2 rounded-xl bg-card border-2 border-foreground shadow-[2px_2px_0_hsl(var(--foreground))] cursor-grab active:cursor-grabbing",
                        dragSnapshot.isDragging && "ring-2 ring-primary/40",
                      )}
                      style={dragProvided.draggableProps.style}
                    >
                      <div className={cn("h-11 w-9 rounded-md flex-shrink-0 overflow-hidden",
                        thumb ? "bg-muted border border-foreground/20" : "border border-dashed border-foreground/40 bg-[repeating-linear-gradient(45deg,#F2ECDD_0_5px,#EADFC8_5px_10px)] dark:bg-muted")}>
                        {thumb && (
                          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-body font-bold text-foreground truncate leading-snug">{post.title}</p>
                        <p className="text-[11px] font-body text-muted-foreground truncate">
                          {(FORMAT_LABELS[post.format] || post.format || "").toLowerCase()} · {thumb ? situacaoDoPost(post) : "sem mídia"}
                        </p>
                      </div>
                      {onAdd && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onAdd(post.id); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="shrink-0 h-7 w-7 rounded-full border-2 border-foreground bg-card hover:bg-[#FFCF03] text-foreground flex items-center justify-center"
                          aria-label="Pôr na grade"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

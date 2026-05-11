import { useMemo } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Search, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/constants";
import type { Post } from "@/hooks/usePosts";

export const SIDEBAR_DROPPABLE_ID = "feed-sidebar";

export type StatusFilter = "todos" | "editando" | "agendado" | "publicado";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "editando", label: "Editando" },
  { key: "agendado", label: "Agendado" },
  { key: "publicado", label: "Publicado" },
];

const STATUS_STYLES: Record<string, string> = {
  editando: "bg-accent text-foreground",
  agendado: "bg-primary/10 text-primary",
  publicado: "bg-secondary/20 text-secondary",
};

type Props = {
  posts: Post[];
  thumbnails: Record<string, string | null>;
  statusFilter: StatusFilter;
  onStatusFilterChange: (s: StatusFilter) => void;
  searchFilter: string;
  onSearchFilterChange: (q: string) => void;
};

export function FeedSidebar({
  posts,
  thumbnails,
  statusFilter,
  onStatusFilterChange,
  searchFilter,
  onSearchFilterChange,
}: Props) {
  const filteredPosts = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, statusFilter, searchFilter]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchFilter}
            onChange={(e) => onSearchFilterChange(e.target.value)}
            placeholder="Buscar posts..."
            className="pl-8 h-9 rounded-xl text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onStatusFilterChange(f.key)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-body border transition-colors",
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
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
            className={cn(
              "flex-1 overflow-y-auto p-2 space-y-2 transition-colors",
              snapshot.isDraggingOver && "bg-primary/5"
            )}
          >
            {filteredPosts.length === 0 && (
              <div className="text-center py-8 px-3">
                <p className="text-xs font-body text-muted-foreground">
                  Nenhum post disponível com esses filtros.
                </p>
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
                        "flex items-center gap-2.5 p-2 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-warm transition-all cursor-grab active:cursor-grabbing",
                        dragSnapshot.isDragging && "shadow-warm-lg border-primary ring-2 ring-primary/30"
                      )}
                      style={dragProvided.draggableProps.style}
                    >
                      <div className="h-12 w-12 rounded-lg bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={post.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body font-medium text-foreground line-clamp-1 leading-snug">
                          {post.title}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          {post.status && (
                            <span
                              className={cn(
                                "text-[10px] font-body px-1.5 py-0.5 rounded-md capitalize",
                                STATUS_STYLES[post.status] ?? "bg-muted text-muted-foreground"
                              )}
                            >
                              {post.status}
                            </span>
                          )}
                          <span className="text-[10px] font-body px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                            {FORMAT_LABELS[post.format] || post.format}
                          </span>
                        </div>
                      </div>
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

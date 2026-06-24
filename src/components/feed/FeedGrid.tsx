import { Droppable, Draggable } from "@hello-pangea/dnd";
import { FileText, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Post } from "@/hooks/usePosts";
import type { Pillar } from "@/hooks/usePillars";

export const GRID_DROPPABLE_ID = "feed-grid";
const MIN_VISIBLE_CELLS = 9;

type Props = {
  posts: Post[];
  pillars: Pillar[];
  thumbnails: Record<string, string | null>;
  onRemove: (postId: string) => void;
};

export function FeedGrid({ posts, pillars, thumbnails, onRemove }: Props) {
  const pillarById = new Map(pillars.map((p) => [p.id, p]));
  const emptyCount = Math.max(0, MIN_VISIBLE_CELLS - posts.length);

  return (
    <Droppable droppableId={GRID_DROPPABLE_ID}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            "grid grid-cols-3 gap-0.5 transition-colors",
            snapshot.isDraggingOver && "bg-primary/5"
          )}
        >
          {posts.map((post, index) => {
            const pillar = post.pillar_id ? pillarById.get(post.pillar_id) : undefined;
            const thumb = thumbnails[post.id] ?? null;
            return (
              <Draggable key={post.id} draggableId={`grid-${post.id}`} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={cn(
                      "aspect-[4/5] relative group cursor-pointer overflow-hidden bg-muted",
                      dragSnapshot.isDragging && "ring-2 ring-primary shadow-warm-lg z-10"
                    )}
                    style={dragProvided.draggableProps.style}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={post.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-primary/20 to-primary/5"
                        style={pillar ? { backgroundColor: pillar.color } : undefined}
                      >
                        <FileText className={cn("h-6 w-6 mb-1", pillar ? "text-primary-foreground/80" : "text-muted-foreground")} strokeWidth={1.5} />
                        <p className={cn(
                          "text-[10px] font-body line-clamp-2 leading-tight",
                          pillar ? "text-primary-foreground" : "text-muted-foreground"
                        )}>
                          {post.title}
                        </p>
                      </div>
                    )}

                    {/* Desktop: título no hover */}
                    <div className="hidden md:flex absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center">
                      <p className="text-white text-xs font-body font-medium text-center px-3 line-clamp-2">{post.title}</p>
                    </div>

                    {/* Mobile: legenda fixa em baixo (sem hover no toque) */}
                    {thumb && (
                      <div className="md:hidden absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/75 to-transparent px-1.5 pt-5 pb-1 pointer-events-none">
                        <p className="text-white text-[9px] font-body line-clamp-1">{post.title}</p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(post.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute top-1 right-1 h-7 w-7 rounded-full bg-foreground/70 hover:bg-destructive text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      aria-label="Remover do feed"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </Draggable>
            );
          })}
          {provided.placeholder}
          {Array.from({ length: emptyCount }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="aspect-[4/5] border border-dashed border-border/50 flex items-center justify-center bg-background/40"
            >
              <Plus className="h-5 w-5 text-muted-foreground/30" strokeWidth={1.5} />
            </div>
          ))}
        </div>
      )}
    </Droppable>
  );
}

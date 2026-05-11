import { Droppable, Draggable } from "@hello-pangea/dnd";
import { ImageOff, X } from "lucide-react";
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
            "grid grid-cols-3 gap-[2px] sm:gap-1 bg-card p-[2px] sm:p-1 rounded-b-2xl border border-t-0 border-border transition-colors",
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
                      "relative aspect-square overflow-hidden group bg-muted",
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
                        className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center"
                        style={{ backgroundColor: pillar?.color ?? "hsl(var(--muted))" }}
                      >
                        <ImageOff className={cn("h-4 w-4 mb-1", pillar ? "text-primary-foreground/70" : "text-muted-foreground")} />
                        <p className={cn(
                          "text-[10px] sm:text-xs font-body font-medium line-clamp-3 leading-tight",
                          pillar ? "text-primary-foreground" : "text-foreground"
                        )}>
                          {post.title}
                        </p>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-end p-1.5 sm:p-2 opacity-0 group-hover:opacity-100">
                      <p className="text-[10px] sm:text-xs font-body font-medium text-white line-clamp-2 leading-tight">
                        {post.title}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(post.id);
                      }}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-foreground/60 hover:bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remover do feed"
                    >
                      <X className="h-3 w-3" />
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
              className="aspect-square border border-dashed border-border/70 rounded-sm flex items-center justify-center bg-background/50"
            >
              <span className="text-[10px] font-body text-muted-foreground/70">Arraste um post</span>
            </div>
          ))}
        </div>
      )}
    </Droppable>
  );
}

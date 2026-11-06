import { useState } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Clapperboard, Copy, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Post } from "@/hooks/usePosts";
import type { Pillar } from "@/hooks/usePillars";
import { parseDateOnly } from "@/lib/date-br";

/* GRADE FIEL AO INSTAGRAM (Walter, 06/11/2026: "estilo a grade do iPhone bem
   fidedigna"). 3 colunas, 2px entre as fotos, recorte 3:4 (o Instagram passou a
   mostrar o perfil em retângulo em 2025), ícone de carrossel/Reels no canto e
   nenhum título por cima. O que ainda vai sair ganha só um selo pequeno com a
   data; o que não tem mídia fica tracejado com o título pequeno. */

export const GRID_DROPPABLE_ID = "feed-grid";
const MIN_VISIBLE_CELLS = 9;

// Post JA PUBLICADO no Instagram (vem do instagram-sync). Entra no fim do grid,
// como pano de fundo real: os planejados ficam em cima, do jeito que vao cair.
export type IgGridPost = {
  id: string;
  thumb: string | null;
  permalink: string | null;
  mediaType: string | null;
};

type Props = {
  posts: Post[];
  pillars: Pillar[];
  thumbnails: Record<string, string | null>;
  igPosts?: IgGridPost[];
  onRemove: (postId: string) => void;
  /** Aba Reels: célula em 9:16, como o Instagram mostra os Reels. */
  reels?: boolean;
  /** Com filtro ligado (esconder sem mídia, aba Reels) a ordem não muda: arrastar desliga. */
  podeArrastar?: boolean;
};

const ehVideo = (formato: string | null | undefined) => formato === "reels" || formato === "video";
const ehCarrossel = (formato: string | null | undefined) => formato === "carrossel";

function seloData(p: Post): string | null {
  if (p.status === "publicado") return null;
  if (!p.scheduled_date) return "sem data";
  const d = parseDateOnly(p.scheduled_date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function IconeTipo({ video, carrossel }: { video: boolean; carrossel: boolean }) {
  if (!video && !carrossel) return null;
  const Icone = video ? Clapperboard : Copy;
  return (
    <span className="absolute top-1.5 right-1.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.55)] pointer-events-none">
      <Icone className={cn("h-[18px] w-[18px]", carrossel && "scale-x-[-1]")} strokeWidth={2} />
    </span>
  );
}

export function FeedGrid({ posts, pillars: _pillars, thumbnails, igPosts = [], onRemove, reels = false, podeArrastar = true }: Props) {
  const [tocado, setTocado] = useState<string | null>(null);
  const emptyCount = reels ? 0 : Math.max(0, MIN_VISIBLE_CELLS - posts.length - igPosts.length);
  const formato = reels ? "aspect-[9/16]" : "aspect-[3/4]";

  return (
    <Droppable droppableId={GRID_DROPPABLE_ID} isDropDisabled={!podeArrastar}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn("grid grid-cols-3 gap-[2px] transition-colors", snapshot.isDraggingOver && "bg-primary/10")}
        >
          {posts.map((post, index) => {
            const thumb = thumbnails[post.id] ?? null;
            const selo = seloData(post);
            const aberto = tocado === post.id;
            return (
              <Draggable key={post.id} draggableId={`grid-${post.id}`} index={index} isDragDisabled={!podeArrastar}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    onClick={() => setTocado(aberto ? null : post.id)}
                    className={cn(
                      formato,
                      "relative group cursor-pointer overflow-hidden",
                      thumb ? "bg-[#EFEFEF] dark:bg-[#262626]" : "bg-[#FAFAFA] dark:bg-[#121212]",
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
                        draggable={false}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="absolute inset-1 flex flex-col items-center justify-center gap-1 p-2 text-center border border-dashed border-[#B5B5B5] dark:border-[#555] rounded-[2px]">
                        <span className="text-[9.5px] font-body font-bold uppercase tracking-wider text-[#8E8E8E]">sem mídia</span>
                        <p className="text-[11px] font-body leading-tight text-[#737373] dark:text-[#A8A8A8] line-clamp-3">{post.title}</p>
                      </div>
                    )}

                    {thumb && <IconeTipo video={ehVideo(post.format)} carrossel={ehCarrossel(post.format)} />}

                    {selo && (
                      <span className="absolute left-1.5 top-1.5 rounded-[5px] bg-black/55 px-1.5 py-[1px] text-[10px] font-body font-semibold text-white backdrop-blur-[2px] pointer-events-none tabular-nums">
                        {selo}
                      </span>
                    )}

                    {/* Computador: título ao passar o mouse. Celular: ao tocar. */}
                    {thumb && (
                      <div className={cn(
                        "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 transition-opacity pointer-events-none",
                        aberto ? "opacity-100" : "opacity-0 md:group-hover:opacity-100",
                      )}>
                        <p className="text-white text-[11px] font-body leading-tight line-clamp-2">{post.title}</p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTocado(null);
                        onRemove(post.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={cn(
                        "absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 hover:bg-destructive text-white flex items-center justify-center transition-opacity",
                        aberto ? "opacity-100" : "opacity-0 pointer-events-none md:pointer-events-auto md:group-hover:opacity-100",
                      )}
                      aria-label="Tirar do feed"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </Draggable>
            );
          })}
          {provided.placeholder}
          {/* O feed que JA existe no Instagram, na ordem real (mais recente
              primeiro). Nao arrasta nem remove: e retrato, nao rascunho. */}
          {igPosts.map((ig) => (
            <a
              key={`ig-${ig.id}`}
              href={ig.permalink ?? undefined}
              target="_blank"
              rel="noreferrer"
              className={cn(formato, "relative overflow-hidden bg-[#EFEFEF] dark:bg-[#262626] block")}
              aria-label="Post publicado no Instagram"
            >
              {ig.thumb && (
                <img
                  src={ig.thumb}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <IconeTipo video={ig.mediaType === "VIDEO" || ig.mediaType === "REELS"} carrossel={ig.mediaType === "CAROUSEL_ALBUM"} />
            </a>
          ))}
          {Array.from({ length: emptyCount }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className={cn(formato, "border border-dashed border-[#DBDBDB] dark:border-[#363636] flex items-center justify-center")}
            >
              <Plus className="h-5 w-5 text-[#C7C7C7]" strokeWidth={1.5} />
            </div>
          ))}
        </div>
      )}
    </Droppable>
  );
}

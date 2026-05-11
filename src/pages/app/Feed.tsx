import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Grid3X3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePosts, type Post } from "@/hooks/usePosts";
import { useProfile } from "@/hooks/useProfile";
import { usePillars } from "@/hooks/usePillars";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FeedProfileHeader } from "@/components/feed/FeedProfileHeader";
import { FeedGrid, GRID_DROPPABLE_ID } from "@/components/feed/FeedGrid";
import { FeedSidebar, SIDEBAR_DROPPABLE_ID, type StatusFilter } from "@/components/feed/FeedSidebar";

const FEED_STATUSES = ["editando", "agendado", "publicado"] as const;
type FeedStatus = (typeof FEED_STATUSES)[number];

function isFeedStatus(status: string | null | undefined): status is FeedStatus {
  return !!status && (FEED_STATUSES as readonly string[]).includes(status);
}

function sortPublishedDesc(a: Post, b: Post): number {
  const aDate = a.published_at ?? a.created_at ?? "";
  const bDate = b.published_at ?? b.created_at ?? "";
  return bDate.localeCompare(aDate);
}

const Feed = () => {
  const { user } = useAuth();
  const { posts, isLoading: postsLoading } = usePosts();
  const { profile } = useProfile();
  const { pillars } = usePillars();

  const feedPosts = useMemo(() => posts.filter((p) => isFeedStatus(p.status)), [posts]);

  const [gridPosts, setGridPosts] = useState<Post[]>([]);
  const [availablePosts, setAvailablePosts] = useState<Post[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [searchFilter, setSearchFilter] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (postsLoading) return;
    if (feedPosts.length === 0) {
      initializedRef.current = true;
      return;
    }

    let savedOrder: string[] = [];
    try {
      const raw = localStorage.getItem("feed_grid_order");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) savedOrder = parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      savedOrder = [];
    }

    const postsById = new Map(feedPosts.map((p) => [p.id, p]));

    if (savedOrder.length > 0) {
      const grid: Post[] = [];
      const usedIds = new Set<string>();
      for (const id of savedOrder) {
        const post = postsById.get(id);
        if (post && !usedIds.has(id)) {
          grid.push(post);
          usedIds.add(id);
        }
      }
      const available = feedPosts.filter((p) => !usedIds.has(p.id));
      setGridPosts(grid);
      setAvailablePosts(available);
    } else {
      const published = feedPosts.filter((p) => p.status === "publicado").sort(sortPublishedDesc);
      const others = feedPosts.filter((p) => p.status !== "publicado");
      setGridPosts(published);
      setAvailablePosts(others);
    }
    initializedRef.current = true;
  }, [postsLoading, feedPosts]);

  useEffect(() => {
    if (!initializedRef.current) return;
    try {
      localStorage.setItem("feed_grid_order", JSON.stringify(gridPosts.map((p) => p.id)));
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, [gridPosts]);

  useEffect(() => {
    if (!initializedRef.current) return;
    const gridIds = new Set(gridPosts.map((p) => p.id));
    const known = new Set([...gridIds, ...availablePosts.map((p) => p.id)]);
    const incoming = feedPosts.filter((p) => !known.has(p.id));
    const stillValidIds = new Set(feedPosts.map((p) => p.id));

    if (incoming.length === 0) {
      const filteredGrid = gridPosts.filter((p) => stillValidIds.has(p.id));
      const filteredAvail = availablePosts.filter((p) => stillValidIds.has(p.id) && !gridIds.has(p.id));
      if (filteredGrid.length !== gridPosts.length) setGridPosts(filteredGrid);
      if (filteredAvail.length !== availablePosts.length) setAvailablePosts(filteredAvail);
      return;
    }
    setAvailablePosts((prev) => {
      const merged = [...incoming, ...prev.filter((p) => stillValidIds.has(p.id) && !gridIds.has(p.id))];
      const seen = new Set<string>();
      return merged.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
    });
    setGridPosts((prev) => prev.filter((p) => stillValidIds.has(p.id)));
  }, [feedPosts, gridPosts, availablePosts]);

  const relevantPostIds = useMemo(() => feedPosts.map((p) => p.id), [feedPosts]);

  const { data: thumbnails = {} } = useQuery<Record<string, string | null>>({
    queryKey: ["feed-thumbnails", user?.id, relevantPostIds.sort().join(",")],
    enabled: !!user?.id && relevantPostIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_media_refs")
        .select("post_id, thumbnail_url, created_at")
        .eq("user_id", user!.id)
        .in("post_id", relevantPostIds)
        .order("created_at");
      if (error) throw error;
      const map: Record<string, string | null> = {};
      for (const row of data ?? []) {
        if (!row.post_id) continue;
        if (map[row.post_id]) continue;
        map[row.post_id] = row.thumbnail_url ?? null;
      }
      return map;
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const postId = draggableId.replace(/^(grid|sidebar)-/, "");

    if (source.droppableId === GRID_DROPPABLE_ID && destination.droppableId === GRID_DROPPABLE_ID) {
      setGridPosts((prev) => {
        const next = [...prev];
        const [moved] = next.splice(source.index, 1);
        next.splice(destination.index, 0, moved);
        return next;
      });
      return;
    }

    if (source.droppableId === SIDEBAR_DROPPABLE_ID && destination.droppableId === SIDEBAR_DROPPABLE_ID) {
      setAvailablePosts((prev) => {
        const next = [...prev];
        const [moved] = next.splice(source.index, 1);
        next.splice(destination.index, 0, moved);
        return next;
      });
      return;
    }

    if (source.droppableId === SIDEBAR_DROPPABLE_ID && destination.droppableId === GRID_DROPPABLE_ID) {
      const post = availablePosts.find((p) => p.id === postId);
      if (!post) return;
      setAvailablePosts((prev) => prev.filter((p) => p.id !== postId));
      setGridPosts((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        const next = [...prev];
        next.splice(destination.index, 0, post);
        return next;
      });
      return;
    }

    if (source.droppableId === GRID_DROPPABLE_ID && destination.droppableId === SIDEBAR_DROPPABLE_ID) {
      const post = gridPosts.find((p) => p.id === postId);
      if (!post) return;
      setGridPosts((prev) => prev.filter((p) => p.id !== postId));
      setAvailablePosts((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        const next = [...prev];
        next.splice(destination.index, 0, post);
        return next;
      });
    }
  };

  const removeFromGrid = (postId: string) => {
    const post = gridPosts.find((p) => p.id === postId);
    if (!post) return;
    setGridPosts((prev) => prev.filter((p) => p.id !== postId));
    setAvailablePosts((prev) => {
      if (prev.some((p) => p.id === post.id)) return prev;
      return [post, ...prev];
    });
  };

  const sidebarPanel = (
    <FeedSidebar
      posts={availablePosts}
      thumbnails={thumbnails}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      searchFilter={searchFilter}
      onSearchFilterChange={setSearchFilter}
    />
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="pb-20 md:pb-0">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm shrink-0">
                <Grid3X3 className="h-5 w-5 text-white" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Meu Feed</h1>
                <p className="text-muted-foreground font-body mt-0.5 text-sm hidden sm:block">
                  Organize visualmente como seu feed do Instagram vai ficar.
                </p>
              </div>
            </div>
            <div className="md:hidden">
              <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0">
                    <LayoutGrid className="h-4 w-4 mr-1.5" />
                    Posts ({availablePosts.length})
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[88%] max-w-sm flex flex-col">
                  <SheetHeader className="px-4 py-3 border-b border-border">
                    <SheetTitle className="text-base font-display">Posts disponíveis</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 overflow-hidden">{sidebarPanel}</div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 md:gap-6">
            <aside className="hidden md:flex flex-col h-[calc(100vh-180px)] sticky top-4 bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-xs font-body font-semibold uppercase tracking-widest text-muted-foreground">
                  Posts disponíveis
                </p>
              </div>
              {sidebarPanel}
            </aside>

            <section>
              <FeedProfileHeader profile={profile} postCount={gridPosts.length} />
              <FeedGrid
                posts={gridPosts}
                pillars={pillars}
                thumbnails={thumbnails}
                onRemove={removeFromGrid}
              />
              {feedPosts.length === 0 && !postsLoading && (
                <div className="mt-6 text-center py-10 px-4 rounded-2xl border border-dashed border-border bg-card">
                  <p className="text-sm font-body text-muted-foreground">
                    Você ainda não tem posts em <span className="font-semibold">Editando</span>,{" "}
                    <span className="font-semibold">Agendado</span> ou{" "}
                    <span className="font-semibold">Publicado</span>. Comece criando posts em "Estou Criando".
                  </p>
                </div>
              )}
            </section>
          </div>
        </motion.div>
      </div>
    </DragDropContext>
  );
};

export default Feed;

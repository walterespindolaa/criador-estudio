import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, LayoutDashboard, PenLine, Video, Scissors, Calendar, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PostDrawer } from "@/components/kanban/PostDrawer";
import { FORMAT_LABELS, STATUS_OPTIONS } from "@/lib/constants";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Post {
  id: string; title: string; platform: string; format: string; pillar_id: string | null;
  status: string; hook: string | null; script: string | null; caption: string | null;
  cta: string | null; scheduled_date: string | null; published_at: string | null;
  notes: string | null; result_views: number | null; result_saves: number | null;
  result_comments: number | null; archive_summary: string | null; user_id: string;
  content_blocks: { tema: string; roteiro: string; midia: string; legenda: string } | null;
}

interface Pillar { id: string; name: string; color: string; }

const COLUMNS = [
  { key: "ideia", label: "Ideia", icon: LayoutDashboard, bg: "bg-muted" },
  { key: "roteiro", label: "Roteiro", icon: PenLine, bg: "bg-primary/5" },
  { key: "gravando", label: "Gravando", icon: Video, bg: "bg-secondary/10" },
  { key: "editando", label: "Editando", icon: Scissors, bg: "bg-accent" },
  { key: "agendado", label: "Agendado", icon: Calendar, bg: "bg-primary/10" },
  { key: "publicado", label: "Publicado", icon: CheckCircle2, bg: "bg-secondary/20" },
];

const Criando = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [draggedPost, setDraggedPost] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    const [postsRes, pillarsRes] = await Promise.all([
      supabase.from("posts").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("pillars").select("*").eq("user_id", user.id).order("position"),
    ]);
    setPosts(postsRes.data || []);
    setPillars(pillarsRes.data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const openNew = () => { setSelectedPost(null); setDrawerOpen(true); };
  const openEdit = (post: Post) => { setSelectedPost(post); setDrawerOpen(true); };

  const handleDrop = async (newStatus: string) => {
    setDragOverCol(null);
    if (!draggedPost || !user) return;
    const updates: any = { status: newStatus };
    if (newStatus === "publicado") {
      updates.published_at = new Date().toISOString();
      const { fireConfetti } = await import("@/lib/confetti");
      fireConfetti();
      await supabase.from("audit_log").insert({ user_id: user.id, action: "post_published", entity_type: "post", entity_id: draggedPost });
    }
    await supabase.from("posts").update(updates).eq("id", draggedPost);
    setDraggedPost(null);
    fetchData();
  };

  const handleMovePost = async (postId: string, newStatus: string) => {
    if (!user) return;
    const updates: any = { status: newStatus };
    if (newStatus === "publicado") {
      updates.published_at = new Date().toISOString();
      const { fireConfetti } = await import("@/lib/confetti");
      fireConfetti();
      await supabase.from("audit_log").insert({ user_id: user.id, action: "post_published", entity_type: "post", entity_id: postId });
    }
    await supabase.from("posts").update(updates).eq("id", postId);
    fetchData();
  };

  const getPillar = (id: string | null) => pillars.find(p => p.id === id);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Estou Criando</h1>
            <p className="text-muted-foreground font-body mt-1">Seu pipeline de criação. Arraste entre colunas.</p>
          </div>
          <Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Post</Button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const colPosts = posts.filter(p => p.status === col.key);
            const isPublished = col.key === "publicado";
            const isDragOver = dragOverCol === col.key;
            return (
              <div key={col.key} className={`min-w-[200px] flex-1 ${isPublished ? "border-l-2 border-dashed border-border pl-4" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }} onDragLeave={() => setDragOverCol(null)} onDrop={() => handleDrop(col.key)}>
                <div className={`${col.bg} rounded-xl px-3 py-2 mb-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-1.5">
                    <col.icon className="h-3.5 w-3.5 text-foreground/70" />
                    <h3 className="font-body font-semibold text-xs text-foreground">{col.label}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-body bg-background/60 px-1.5 py-0.5 rounded-full">{colPosts.length}</span>
                </div>
                <div className={`space-y-3 min-h-[200px] rounded-xl transition-all ${isDragOver ? "ring-2 ring-primary bg-primary/5" : ""}`}>
                  {colPosts.map(post => {
                    const pillar = getPillar(post.pillar_id);
                    return (
                      <motion.div key={post.id} layout draggable onDragStart={() => setDraggedPost(post.id)} onClick={() => openEdit(post)}
                        className={`bg-card rounded-xl p-4 shadow-warm border border-border cursor-grab active:cursor-grabbing hover:shadow-warm-lg transition-all ${isPublished ? "opacity-70" : ""}`}>
                        <p className="font-body font-medium text-sm text-foreground mb-2 leading-snug">{post.title}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <PlatformIcon platform={post.platform as any} size="sm" />
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[post.format] || post.format}</span>
                          {pillar && <span className="px-1.5 py-0.5 rounded text-xs font-body text-primary-foreground" style={{ backgroundColor: pillar.color }}>{pillar.name}</span>}
                          {isPublished && <span className="px-1.5 py-0.5 rounded text-xs font-body bg-secondary text-secondary-foreground">Publicado</span>}
                        </div>
                        {post.scheduled_date && <p className="text-xs text-muted-foreground font-body mt-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.scheduled_date}</p>}
                        <div className="mt-2 md:hidden" onClick={(e) => e.stopPropagation()}>
                          <Select value={post.status} onValueChange={(val) => handleMovePost(post.id, val)}>
                            <SelectTrigger className="h-7 text-xs rounded-lg"><span className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Mover</span></SelectTrigger>
                            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </motion.div>
                    );
                  })}
                  {colPosts.length === 0 && (
                    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isDragOver ? "border-primary" : "border-border"}`}>
                      <p className="text-xs text-muted-foreground font-body">Arraste pra cá</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
      <PostDrawer open={drawerOpen} onOpenChange={setDrawerOpen} post={selectedPost} pillars={pillars} userId={user?.id || ""} onSaved={fetchData} />
    </div>
  );
};

export default Criando;

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PostDrawer } from "@/components/kanban/PostDrawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sanitizeText } from "@/lib/sanitize";
import { useIdeas, type Idea } from "@/hooks/useIdeas";
import { usePillars } from "@/hooks/usePillars";
import { useProfile } from "@/hooks/useProfile";
import type { Post } from "@/hooks/usePosts";

const ideaSchema = z.object({
  title: z.string().min(1, "Título é obrigatório").max(100, "Máximo 100 caracteres").trim(),
  pillar_id: z.string().optional().nullable(),
  platform: z.string().optional().nullable(),
  notes: z.string().max(500, "Máximo 500 caracteres").optional().nullable(),
  objective: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
});

type IdeaFormData = z.infer<typeof ideaSchema>;

const AI_LIMIT = 10;

const Ideias = () => {
  const { user } = useAuth();
  const { ideas, createIdea, updateIdea, deleteIdea, promoteToPost } = useIdeas();
  const { pillars } = usePillars();
  const { profile } = useProfile();

  const [search, setSearch] = useState("");
  const [filterPillar, setFilterPillar] = useState<string | null>(null);
  const [filterObjective, setFilterObjective] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<IdeaFormData>({
    resolver: zodResolver(ideaSchema),
  });

  const [postDrawerOpen, setPostDrawerOpen] = useState(false);
  const [promotedPost, setPromotedPost] = useState<Post | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const resetAt = profile?.ai_ideas_reset_at ?? today;
  const resetMonth = String(resetAt).substring(0, 7);
  const currentMonth = today.substring(0, 7);
  const aiUsed = resetMonth === currentMonth ? (profile?.ai_ideas_used_month ?? 0) : 0;

  const openNew = () => {
    setEditingIdea(null);
    reset({ title: "", pillar_id: "", platform: "", notes: "", objective: "", origin: "" });
    setSheetOpen(true);
  };

  const openEdit = (idea: Idea) => {
    setEditingIdea(idea);
    reset({
      title: idea.title,
      pillar_id: idea.pillar_id || "",
      platform: idea.platform || "",
      notes: idea.notes || "",
      objective: idea.objective || "",
      origin: idea.origin || "",
    });
    setSheetOpen(true);
  };

  const handleSave = async (data: IdeaFormData) => {
    if (!user) return;
    const payload = {
      title: sanitizeText(data.title),
      pillar_id: data.pillar_id || null,
      platform: data.platform || null,
      notes: data.notes ? sanitizeText(data.notes) : null,
      objective: data.objective || null,
      origin: data.origin || null,
    };
    try {
      if (editingIdea) {
        await updateIdea.mutateAsync({ id: editingIdea.id, updates: payload });
        toast.success("Ideia atualizada!");
      } else {
        await createIdea.mutateAsync(payload);
        toast.success("Ideia capturada!");
      }
      setSheetOpen(false);
    } catch {
      toast.error(editingIdea ? "Erro ao atualizar." : "Erro ao salvar.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIdea.mutateAsync(id);
      toast.success("Ideia removida.");
    } catch {
      toast.error("Erro ao remover ideia.");
    }
  };

  const handlePromoteToPost = async (idea: Idea) => {
    if (!user) return;
    try {
      const newPost = await promoteToPost.mutateAsync({
        ideaId: idea.id,
        post: {
          title: idea.title,
          platform: idea.platform || "instagram",
          format: "reels",
          pillar_id: idea.pillar_id,
          status: "ideia",
          notes: idea.notes,
        },
      });
      await updateIdea.mutateAsync({
        id: idea.id,
        updates: { idea_status: "em_producao" },
      });
      toast.success("Ideia virou post! Agora é só criar. 🎬");
      setPromotedPost(newPost);
      setPostDrawerOpen(true);
    } catch {
      toast.error("Erro ao criar post.");
    }
  };

  const filtered = ideas.filter(idea => {
    const matchSearch = !search || idea.title.toLowerCase().includes(search.toLowerCase());
    const matchPillar = !filterPillar || idea.pillar_id === filterPillar;
    const matchObj = !filterObjective || idea.objective === filterObjective;
    const matchStatus = !filterStatus || idea.idea_status === filterStatus;
    return matchSearch && matchPillar && matchObj && matchStatus;
  });

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Minhas Ideias</h1>
            <p className="text-muted-foreground font-body mt-1">Seu banco de inspirações.</p>
          </div>
          <div className="flex items-center gap-2">
            {aiUsed > 0 && (
              <span className="text-[10px] text-muted-foreground/50 font-body">
                {AI_LIMIT - aiUsed}/{AI_LIMIT} sugestões restantes
              </span>
            )}
            <Button variant="hero" onClick={openNew} className="hidden md:flex"><Plus className="h-4 w-4 mr-1" /> Nova Ideia</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(idea => (
            <div key={idea.id} className="bg-card rounded-2xl p-5 border border-border">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-display font-semibold text-foreground line-clamp-2">{idea.title}</h3>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(idea)} className="p-1 hover:bg-accent rounded"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(idea.id)} className="p-1 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <Button variant="hero" size="sm" onClick={() => handlePromoteToPost(idea)} disabled={!!idea.promoted_to_post_id}>
                {idea.promoted_to_post_id ? "Já virou post" : "Criar post →"}
              </Button>
            </div>
          ))}
        </div>
      </motion.div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingIdea ? "Editar Ideia" : "Nova Ideia"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(handleSave)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input {...register("title")} placeholder="Sua ideia..." />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea {...register("notes")} placeholder="Mais detalhes..." />
              {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
            </div>
            <div className="flex gap-3">
              <Button type="submit" variant="hero" className="flex-1">Salvar</Button>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {promotedPost && (
        <PostDrawer
          open={postDrawerOpen}
          onOpenChange={setPostDrawerOpen}
          post={promotedPost}
          pillars={pillars}
          userId={user?.id || ""}
          onSaved={() => { /* React Query invalidations handle refresh */ }}
        />
      )}
    </div>
  );
};

export default Ideias;

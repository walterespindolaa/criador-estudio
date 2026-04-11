import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Plus, Lightbulb, Search, ArrowRight, Trash2, Edit2, Sparkles, ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { suggestTag } from "@/lib/ai/claude";
import { PostDrawer } from "@/components/kanban/PostDrawer";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { sanitizeText } from "@/lib/sanitize";

interface Idea {
  id: string;
  title: string;
  pillar_id: string | null;
  platform: string | null;
  notes: string | null;
  objective: string | null;
  origin: string | null;
  idea_status: string | null;
  promoted_to_post_id: string | null;
  created_at: string;
}

interface Pillar {
  id: string;
  name: string;
  color: string;
}

const ideaSchema = z.object({
  title: z.string().min(1, "Título é obrigatório").max(100, "Máximo 100 caracteres").trim(),
  pillar_id: z.string().optional().nullable(),
  platform: z.string().optional().nullable(),
  notes: z.string().max(500, "Máximo 500 caracteres").optional().nullable(),
  objective: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
});

type IdeaFormData = z.infer<typeof ideaSchema>;

const OBJECTIVES = [
  { key: "engajamento", label: "Engajamento" },
  { key: "autoridade", label: "Autoridade" },
  { key: "venda", label: "Venda" },
  { key: "relacionamento", label: "Relacionamento" },
  { key: "prova_social", label: "Prova Social" },
  { key: "bastidor", label: "Bastidor" },
];

const IDEA_STATUSES = [
  { key: "nova", label: "Nova", color: "bg-blue-100 text-blue-700" },
  { key: "validada", label: "Validada", color: "bg-green-100 text-green-700" },
  { key: "em_producao", label: "Em produção", color: "bg-yellow-100 text-yellow-700" },
  { key: "usada", label: "Usada", color: "bg-gray-200 text-gray-600" },
  { key: "arquivada", label: "Arquivada", color: "bg-gray-100 text-gray-400" },
];

const AI_LIMIT = 10;

const Ideias = () => {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [search, setSearch] = useState("");
  const [filterPillar, setFilterPillar] = useState<string | null>(null);
  const [filterObjective, setFilterObjective] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<IdeaFormData>({
    resolver: zodResolver(ideaSchema),
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{
    titulo: string; formato: string; angulo?: string; objetivo: string;
  }>>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiUsed, setAiUsed] = useState(0);
  const [targetIdeaId, setTargetIdeaId] = useState<string | null>(null);
  const [postDrawerOpen, setPostDrawerOpen] = useState(false);
  const [promotedPost, setPromotedPost] = useState<any>(null);

  const fetchData = async () => {
    if (!user) return;
    const [ideasRes, pillarsRes, profileRes] = await Promise.all([
      supabase.from("ideas").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("pillars").select("*").eq("user_id", user.id).order("position"),
      supabase.from("profiles").select("ai_ideas_used_month, ai_ideas_reset_at").eq("id", user.id).single(),
    ]);
    setIdeas((ideasRes.data as any[]) || []);
    setPillars(pillarsRes.data || []);

    const today = new Date().toISOString().split("T")[0];
    const resetAt = (profileRes.data as any)?.ai_ideas_reset_at || today;
    const resetMonth = String(resetAt).substring(0, 7);
    const currentMonth = today.substring(0, 7);
    setAiUsed(resetMonth === currentMonth ? ((profileRes.data as any)?.ai_ideas_used_month || 0) : 0);
  };

  useEffect(() => { fetchData(); }, [user]);

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
    const insertData: any = {
      ...data,
      title: sanitizeText(data.title),
      notes: data.notes ? sanitizeText(data.notes) : null,
      user_id: user.id,
    };
    if (editingIdea) {
      const { error } = await supabase.from("ideas").update(insertData).eq("id", editingIdea.id);
      if (error) { toast.error("Erro ao atualizar."); return; }
      toast.success("Ideia atualizada!");
    } else {
      const { error } = await supabase.from("ideas").insert(insertData);
      if (error) { toast.error("Erro ao salvar."); return; }
      toast.success("Ideia capturada!");
    }
    setSheetOpen(false); fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ideas").delete().eq("id", id);
    if (!error) { toast.success("Ideia removida."); fetchData(); }
  };

  const handlePromoteToPost = async (idea: Idea) => {
    if (!user) return;
    const { data: newPost, error } = await supabase.from("posts").insert({
      user_id: user.id, title: idea.title, platform: idea.platform || "instagram", format: "reels",
      pillar_id: idea.pillar_id, status: "ideia", notes: idea.notes,
    }).select().single();
    if (error || !newPost) { toast.error("Erro ao criar post."); return; }
    await supabase.from("ideas").update({ promoted_to_post_id: newPost.id, idea_status: "em_producao" } as any).eq("id", idea.id);
    await supabase.from("audit_log").insert({ user_id: user.id, action: "idea_promoted", entity_type: "idea", entity_id: idea.id, metadata: { post_id: newPost.id } });
    toast.success("Ideia virou post! Agora é só criar. 🎬");
    setPromotedPost(newPost); setPostDrawerOpen(true); fetchData();
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
          onSaved={() => fetchData()} 
        />
      )}
    </div>
  );
};

export default Ideias;

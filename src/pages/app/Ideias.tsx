import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Edit2, Sparkles, Loader2 } from "lucide-react";
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
import { usePosts, type Post } from "@/hooks/usePosts";
import { getIdeaSuggestions } from "@/lib/ai/claude";

const ideaSchema = z.object({
  title: z.string().min(1, "Título é obrigatório").max(100, "Máximo 100 caracteres").trim(),
  pillar_id: z.string().optional().nullable(),
  platform: z.string().optional().nullable(),
  notes: z.string().max(500, "Máximo 500 caracteres").optional().nullable(),
  objective: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
});

type IdeaFormData = z.infer<typeof ideaSchema>;

interface AISuggestion {
  titulo: string;
  formato: string;
  angulo: string;
  objetivo: string;
}

const PLATFORM_PRESETS = [
  { value: "instagram", label: "Instagram" },
  { value: "reels", label: "Reels" },
  { value: "carrossel", label: "Carrossel" },
  { value: "story", label: "Story" },
  { value: "youtube", label: "YouTube" },
];

const AI_LIMIT = 10;

function parseSuggestions(result: unknown): AISuggestion[] {
  const raw = typeof result === "string"
    ? JSON.parse(result.replace(/```json\n?|\n?```/g, "").trim())
    : result;
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is AISuggestion =>
    !!s && typeof s === "object"
    && typeof (s as AISuggestion).titulo === "string"
    && typeof (s as AISuggestion).formato === "string"
    && typeof (s as AISuggestion).angulo === "string"
    && typeof (s as AISuggestion).objetivo === "string"
  );
}

const Ideias = () => {
  const { user } = useAuth();
  const { ideas, createIdea, updateIdea, deleteIdea, promoteToPost } = useIdeas();
  const { pillars } = usePillars();
  const { profile } = useProfile();
  const { createPost } = usePosts();

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

  const [expandedIdeaId, setExpandedIdeaId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

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

  const toggleAiPanel = (ideaId: string) => {
    if (expandedIdeaId === ideaId) {
      setExpandedIdeaId(null);
      setAiSuggestions([]);
      return;
    }
    setExpandedIdeaId(ideaId);
    setAiSuggestions([]);
    setSelectedPlatform("instagram");
  };

  const handleGenerateSuggestions = async (idea: Idea) => {
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const pillarName = pillars.find(p => p.id === idea.pillar_id)?.name;
      const result = await getIdeaSuggestions({
        ideiaTexto: idea.title,
        platform: selectedPlatform,
        pilar: pillarName,
        objetivo: "engajamento",
        niche: profile?.niche || "lifestyle",
      }, user?.id);
      const parsed = parseSuggestions(result);
      if (parsed.length === 0) {
        toast.error("A IA não retornou sugestões válidas.");
        return;
      }
      setAiSuggestions(parsed);
    } catch {
      toast.error("Erro ao gerar sugestões.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateFromSuggestion = async (suggestion: AISuggestion, ideaId: string) => {
    try {
      await createPost.mutateAsync({
        title: suggestion.titulo,
        format: suggestion.formato,
        platform: selectedPlatform,
        status: "roteiro",
      });
      await updateIdea.mutateAsync({
        id: ideaId,
        updates: { idea_status: "em_producao" },
      });
      toast.success("Post criado a partir da sugestão!");
      setExpandedIdeaId(null);
      setAiSuggestions([]);
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
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-sky-500 flex items-center justify-center shadow-sm shrink-0">
              <Lightbulb className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Minhas Ideias</h1>
              <p className="text-muted-foreground font-body mt-0.5 text-sm">Seu banco de inspirações.</p>
            </div>
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
          {filtered.map(idea => {
            const isExpanded = expandedIdeaId === idea.id;
            return (
              <div key={idea.id} className="flex flex-col gap-3">
                <div className="bg-card rounded-xl p-5 border border-border">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-display font-semibold text-foreground line-clamp-2">{idea.title}</h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleAiPanel(idea.id)}
                        className={`p-1 rounded transition-colors ${
                          isExpanded ? "bg-primary/15 text-primary" : "hover:bg-primary/10 text-primary"
                        }`}
                        title="Sugestões de IA"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => openEdit(idea)} className="p-1 hover:bg-accent rounded"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(idea.id)} className="p-1 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <Button variant="hero" size="sm" onClick={() => handlePromoteToPost(idea)} disabled={!!idea.promoted_to_post_id}>
                    {idea.promoted_to_post_id ? "Já virou post" : "Criar post →"}
                  </Button>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="ai-panel"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-body font-semibold text-primary">Sugestões de IA</span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {PLATFORM_PRESETS.map(p => (
                            <button
                              key={p.value}
                              onClick={() => setSelectedPlatform(p.value)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-body border transition-colors ${
                                selectedPlatform === p.value
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card border-border text-foreground hover:border-primary/40"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>

                        <Button
                          size="sm"
                          variant="hero"
                          onClick={() => handleGenerateSuggestions(idea)}
                          disabled={aiLoading}
                          className="w-full"
                        >
                          {aiLoading
                            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Gerando...</>
                            : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Gerar sugestões</>}
                        </Button>

                        {aiLoading && (
                          <div className="space-y-2">
                            {[0, 1, 2].map(i => (
                              <div key={i} className="bg-card/60 border border-border rounded-xl p-3 animate-pulse">
                                <div className="h-3 w-3/4 bg-muted rounded mb-2" />
                                <div className="flex gap-1.5">
                                  <div className="h-3 w-12 bg-muted rounded" />
                                  <div className="h-3 w-14 bg-muted rounded" />
                                  <div className="h-3 w-16 bg-muted rounded" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {!aiLoading && aiSuggestions.length > 0 && (
                          <div className="space-y-2">
                            {aiSuggestions.map((s, i) => (
                              <motion.div
                                key={`${idea.id}-sug-${i}`}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-card border border-primary/20 rounded-xl p-3 space-y-2"
                              >
                                <p className="text-sm font-body font-medium text-foreground leading-snug">
                                  {s.titulo}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-body bg-primary/10 text-primary capitalize">
                                    {s.formato}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-body bg-secondary/10 text-secondary capitalize">
                                    {s.angulo}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-body bg-muted text-muted-foreground capitalize">
                                    {s.objetivo}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-7 text-xs"
                                  onClick={() => handleCreateFromSuggestion(s, idea.id)}
                                  disabled={createPost.isPending}
                                >
                                  Criar post →
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
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

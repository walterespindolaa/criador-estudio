import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Edit2, Sparkles, Loader2, Lightbulb, List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PostEditor } from "@/components/kanban/PostEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sanitizeText } from "@/lib/sanitize";
import { useIdeas, type Idea } from "@/hooks/useIdeas";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
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
  const { ideas, createIdea, updateIdea, deleteIdea, promoteToPost, isLoading: ideasLoading } = useIdeas();
  const { pillars } = usePillars();
  const { profile } = useProfile();
  const { createPost } = usePosts();

  const [search, setSearch] = useState("");
  const [filterPillar, setFilterPillar] = useState<string | null>(null);
  const [filterObjective, setFilterObjective] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteIdea.mutateAsync(deleteTarget.id);
      toast.success("Ideia removida.");
    } catch {
      toast.error("Erro ao remover ideia.");
    } finally {
      setDeleteTarget(null);
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

  if (ideasLoading && ideas.length === 0) {
    return (
      <div className="pb-20 md:pb-0">
        <PageSkeleton />
      </div>
    );
  }

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
            <div className="flex items-center gap-0.5 bg-muted/50 rounded-full p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all",
                  viewMode === "list" ? "bg-card shadow-warm-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={viewMode === "list"}
              >
                <List className="h-3.5 w-3.5 mr-1 inline" /> Lista
              </button>
              <button
                type="button"
                onClick={() => setViewMode("gallery")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all",
                  viewMode === "gallery" ? "bg-card shadow-warm-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={viewMode === "gallery"}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1 inline" /> Galeria
              </button>
            </div>
            <Button variant="hero" onClick={openNew} className="shrink-0" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nova Ideia</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </div>
        </div>

        {viewMode === "gallery" && (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 [&>*]:mb-3">
            {filtered.map((idea) => {
              const pillar = idea.pillar_id ? pillars.find((p) => p.id === idea.pillar_id) : null;
              return (
                <div
                  key={idea.id}
                  onClick={() => openEdit(idea)}
                  className="break-inside-avoid bg-card rounded-xl border border-border p-4 hover:shadow-warm-md hover:scale-[1.01] transition-all cursor-pointer group"
                >
                  {pillar && (
                    <div
                      className="w-full h-24 rounded-lg mb-3"
                      style={{ backgroundColor: pillar.color }}
                    />
                  )}
                  <h3 className="font-display font-semibold text-sm text-foreground line-clamp-2 mb-2">
                    {idea.title}
                  </h3>
                  {idea.notes && (
                    <p className="text-xs font-body text-muted-foreground line-clamp-3 mb-3 whitespace-pre-line">
                      {idea.notes}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {pillar && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-body font-medium">
                        {pillar.name}
                      </span>
                    )}
                    {idea.platform && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-body capitalize">
                        {idea.platform}
                      </span>
                    )}
                    {idea.promoted_to_post_id && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-body font-medium">
                        ✓ Virou post
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "list" && (
        <div className="bg-card border border-border rounded-xl divide-y divide-border/30 overflow-hidden">
          {filtered.map(idea => {
            const isExpanded = expandedIdeaId === idea.id;
            const pillar = idea.pillar_id ? pillars.find(p => p.id === idea.pillar_id) : null;
            return (
              <div key={idea.id}>
                <div
                  onClick={() => openEdit(idea)}
                  className="flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-accent/30 cursor-pointer group transition-colors"
                >
                  <div className="w-5 h-5 rounded border-2 border-border shrink-0 group-hover:border-primary/50 transition-colors" />
                  <p className="font-body text-sm text-foreground flex-1 truncate">
                    {idea.title}
                  </p>
                  <div className="hidden sm:flex gap-1 shrink-0">
                    {pillar && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-body whitespace-nowrap"
                        style={{ backgroundColor: `${pillar.color}20`, color: pillar.color }}
                      >
                        {pillar.name}
                      </span>
                    )}
                    {idea.promoted_to_post_id && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-body whitespace-nowrap">
                        ✓ Post
                      </span>
                    )}
                  </div>
                  <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleAiPanel(idea.id); }}
                      className={cn(
                        "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                        isExpanded ? "bg-primary/15 text-primary" : "hover:bg-accent text-muted-foreground hover:text-primary"
                      )}
                      aria-label="Sugestões de IA"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEdit(idea); }}
                      className="h-7 w-7 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: idea.id, title: idea.title }); }}
                      className="h-7 w-7 rounded-md hover:bg-destructive/10 flex items-center justify-center text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
                      <div className="bg-primary/5 border-t border-primary/15 px-3 sm:px-4 py-4 space-y-3">
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
        )}
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
        <PostEditor
          open={postDrawerOpen}
          onOpenChange={setPostDrawerOpen}
          post={promotedPost}
          pillars={pillars}
          userId={user?.id || ""}
          onSaved={() => { /* React Query invalidations handle refresh */ }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir ideia?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              {deleteTarget ? `"${deleteTarget.title}" será removida permanentemente. Essa ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
              onClick={handleConfirmDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Ideias;

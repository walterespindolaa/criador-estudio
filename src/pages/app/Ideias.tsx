import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Edit2, Sparkles, Loader2, Lightbulb, List, LayoutGrid, Clapperboard, Bookmark, Folder, FolderPlus } from "lucide-react";
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
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { PostEditor } from "@/components/kanban/PostEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sanitizeText } from "@/lib/sanitize";
import { useIdeas, type Idea } from "@/hooks/useIdeas";
import { useIdeaFolders, folderIdDaIdeia, CORES_PASTA } from "@/hooks/useIdeaFolders";
import { hojeBR } from "@/lib/date-br";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SharedIntake } from "@/components/pwa/SharedIntake";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePillars } from "@/hooks/usePillars";
import { useProfile } from "@/hooks/useProfile";
import { useBrandContext } from "@/hooks/useBrandContext";
import { usePosts, type Post } from "@/hooks/usePosts";
import { getIdeaSuggestions } from "@/lib/ai/claude";
import { SavedRefs } from "@/components/ideas/SavedRefs";

const ideaSchema = z.object({
  // 100 cortava título vindo do ChatGPT (a Gabriela cola frases longas).
  title: z.string().min(1, "Título é obrigatório").max(300, "Máximo 300 caracteres").trim(),
  pillar_id: z.string().optional().nullable(),
  platform: z.string().optional().nullable(),
  notes: z.string().max(2000, "Máximo 2000 caracteres").optional().nullable(),
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
  const { activeAccountId } = useActiveAccount();
  const { ideas, createIdea, updateIdea, deleteIdea, promoteToPost, isLoading: ideasLoading } = useIdeas();
  const { pillars } = usePillars();
  const { profile } = useProfile();
  const { brandContext, hasBrandContext } = useBrandContext();
  const { createPost } = usePosts();

  const [search, setSearch] = useState("");
  const [filterPillar, setFilterPillar] = useState<string | null>(null);
  const [filterObjective, setFilterObjective] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
  // Vem do "compartilhar → Cria" (Android PWA): o link pode chegar em url ou dentro de text.
  const _shareRaw = (() => { const sp = new URLSearchParams(window.location.search); return sp.get("url") || sp.get("text") || ""; })();
  const sharedUrl = _shareRaw ? (_shareRaw.match(/https?:\/\/\S+/)?.[0] ?? _shareRaw) : undefined;
  const [mainTab, setMainTab] = useState<"ideias" | "salvos">(sharedUrl ? "salvos" : "ideias");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  /* Pastas (estilo salvos do Instagram): activeFolder filtra a listagem,
     formFolder é a pasta escolhida no diálogo de Nova/Editar Ideia. */
  const { folders, criar: criarPasta, renomear: renomearPasta, excluir: excluirPasta, moverIdeia } = useIdeaFolders();
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [formFolder, setFormFolder] = useState<string | null>(null);
  const [pastasOpen, setPastasOpen] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");
  const [novaPastaCor, setNovaPastaCor] = useState<string>(CORES_PASTA[0]);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<IdeaFormData>({
    resolver: zodResolver(ideaSchema),
  });
  // Pilar escolhido no formulário (chips no diálogo de Nova Ideia/Editar).
  const pilarEscolhido = watch("pillar_id");

  const [postDrawerOpen, setPostDrawerOpen] = useState(false);
  const [promotedPost, setPromotedPost] = useState<Post | null>(null);

  const [expandedIdeaId, setExpandedIdeaId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const today = hojeBR();
  const resetAt = profile?.ai_ideas_reset_at ?? today;
  const resetMonth = String(resetAt).substring(0, 7);
  const currentMonth = today.substring(0, 7);
  const aiUsed = resetMonth === currentMonth ? (profile?.ai_ideas_used_month ?? 0) : 0;

  const openNew = () => {
    setEditingIdea(null);
    reset({ title: "", pillar_id: "", platform: "", notes: "", objective: "", origin: "" });
    // Criando de dentro de uma pasta, a ideia já nasce nela.
    setFormFolder(activeFolder);
    setSheetOpen(true);
  };

  const openEdit = (idea: Idea) => {
    setEditingIdea(idea);
    setFormFolder(folderIdDaIdeia(idea));
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
        // A pasta vai por fora do payload tipado (folder_id ainda não está
        // nos tipos gerados); só grava se mudou.
        if (formFolder !== folderIdDaIdeia(editingIdea)) {
          await moverIdeia.mutateAsync({ ideaId: editingIdea.id, folderId: formFolder });
        }
        toast.success("Ideia atualizada!");
      } else {
        const nova = await createIdea.mutateAsync(payload);
        if (formFolder) await moverIdeia.mutateAsync({ ideaId: nova.id, folderId: formFolder });
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
        // O BRANDBOOK INTEIRO vai junto. Sem isto a IA só via "nicho:
        // lifestyle" e inventava a pessoa: tratou a Gabriela (social media
        // que vende serviço) como creator genérica, sugerindo posts sobre
        // "contratar um creator". Quem a pessoa é e pra quem ela fala está
        // no brandbook, e é dali que a sugestão tem que partir.
        brandContext: hasBrandContext ? brandContext : undefined,
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
    const matchFolder = !activeFolder || folderIdDaIdeia(idea) === activeFolder;
    return matchSearch && matchPillar && matchObj && matchStatus && matchFolder;
  });

  // Contagem por pasta pro chip (igual os salvos do Instagram mostram).
  const contagemPorPasta = ideas.reduce<Record<string, number>>((acc, i) => {
    const f = folderIdDaIdeia(i);
    if (f) acc[f] = (acc[f] ?? 0) + 1;
    return acc;
  }, {});

  const handleCriarPasta = async () => {
    const nome = novaPastaNome.trim();
    if (!nome) return;
    const nova = await criarPasta.mutateAsync({ name: nome, color: novaPastaCor });
    setNovaPastaNome("");
    // Já cai dentro da pasta recém-criada: o próximo passo natural é populá-la.
    setActiveFolder(nova.id);
    setPastasOpen(false);
    toast.success("Pasta criada!");
  };

  if (ideasLoading && ideas.length === 0) {
    return (
      <div className="pb-20 md:pb-0">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-0">
      {/* Chegou algo compartilhado de outro app (Instagram, galeria, navegador). */}
      <SharedIntake />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-wrap items-center justify-between gap-y-2 mb-6 gap-3">
          <div className="flex items-center gap-3 md:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-sky-500 flex items-center justify-center shadow-sm shrink-0">
              <Lightbulb className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Minhas Ideias</h1>
              <p className="text-muted-foreground font-body mt-0.5 text-sm whitespace-nowrap">Seu banco de inspirações.</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-full p-1">
            <button type="button" onClick={() => setMainTab("ideias")}
              className={cn("px-3 py-1.5 rounded-full text-xs font-body font-semibold transition-all", mainTab === "ideias" ? "bg-card shadow-warm-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Lightbulb className="h-3.5 w-3.5 mr-1 inline" /> Ideias
            </button>
            <button data-tour="ideias-salvos" type="button" onClick={() => setMainTab("salvos")}
              className={cn("px-3 py-1.5 rounded-full text-xs font-body font-semibold transition-all", mainTab === "salvos" ? "bg-card shadow-warm-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Bookmark className="h-3.5 w-3.5 mr-1 inline" /> Salvos
            </button>
          </div>
          <div className={cn("flex flex-wrap items-center justify-end gap-2 ml-auto", mainTab !== "ideias" && "hidden")}>
            {aiUsed > 0 && (
              <span className="hidden sm:inline text-[10px] text-muted-foreground/50 font-body">
                {AI_LIMIT - aiUsed}/{AI_LIMIT} sugestões restantes
              </span>
            )}
            <div data-tour="ideias-visualizacao" className="flex items-center gap-0.5 bg-muted/50 rounded-full p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all",
                  viewMode === "list" ? "bg-card shadow-warm-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={viewMode === "list"}
              >
                <List className="h-3.5 w-3.5 sm:mr-1 inline" /> <span className="hidden sm:inline">Lista</span>
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
                <LayoutGrid className="h-3.5 w-3.5 sm:mr-1 inline" /> <span className="hidden sm:inline">Galeria</span>
              </button>
            </div>
            <Button data-tour="ideias-nova" variant="hero" onClick={openNew} className="shrink-0" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nova Ideia</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </div>
        </div>

        {mainTab === "salvos" && <SavedRefs initialUrl={sharedUrl} />}

        {/* Pastas (estilo salvos do Instagram): Todas + uma pílula por pasta.
            Some quando não há ideia nenhuma pra não poluir o estado vazio. */}
        {mainTab === "ideias" && ideas.length > 0 && (
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-none -mx-4 px-4">
            <button type="button" onClick={() => setActiveFolder(null)}
              className={cn("shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body border transition-colors",
                !activeFolder ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
              Todas <span className="opacity-70">{ideas.length}</span>
            </button>
            {folders.map(f => {
              const ativa = activeFolder === f.id;
              return (
                <button key={f.id} type="button" onClick={() => setActiveFolder(ativa ? null : f.id)}
                  className={cn("shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body border transition-colors",
                    ativa ? "font-semibold" : "bg-card border-border text-muted-foreground hover:text-foreground")}
                  style={ativa ? { backgroundColor: `${f.color}1c`, color: f.color, borderColor: f.color } : undefined}>
                  <Folder className="h-3 w-3" style={{ color: f.color }} />
                  {f.name} <span className="opacity-70">{contagemPorPasta[f.id] ?? 0}</span>
                </button>
              );
            })}
            <button type="button" onClick={() => setPastasOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
              <FolderPlus className="h-3.5 w-3.5" /> {folders.length > 0 ? "Pastas" : "Criar pasta"}
            </button>
          </div>
        )}

        {/* A TELA DE IDEIAS NÃO TINHA ESTADO VAZIO e ela é a primeira coisa que
            um criador abre. Ele via um branco e concluía que tinha quebrado.
            Os exemplos existem porque o pior de começar é a folha em branco. */}
        {mainTab === "ideias" && filtered.length === 0 && (
          ideas.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              cor="amarelo"
              sticker="criatura-lampada"
              cornerSticker="selo-social-club-amarelo"
              title="Comece pelo caos da sua cabeça"
              description="Aqui não precisa ser bom. Joga tudo: o pensamento solto, o print que te parou, a frase que você ouviu no Uber. Depois a gente separa o que vira post."
              examples={[
                "aquele erro que todo mundo comete no começo",
                "bastidor: como eu organizo minha semana",
                "responder a pergunta que mais me fazem no direct",
              ]}
              action={{ label: "Anotar minha primeira ideia", onClick: openNew }}
            />
          ) : (
            <EmptyState
              icon={Lightbulb}
              cor="amarelo"
              title="Nenhuma ideia com esse filtro"
              description="Você tem ideias guardadas, só não neste filtro. Troque o filtro pra ver as outras."
            />
          )
        )}

        {mainTab === "ideias" && filtered.length > 0 && viewMode === "gallery" && (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 [&>*]:mb-3">
            {filtered.map((idea) => {
              const pillar = idea.pillar_id ? pillars.find((p) => p.id === idea.pillar_id) : null;
              return (
                <div
                  key={idea.id}
                  onClick={() => { if (expandedIdeaId !== idea.id) openEdit(idea); }}
                  className="relative break-inside-avoid bg-card rounded-xl border border-border p-4 hover:shadow-warm-md hover:scale-[1.01] transition-all cursor-pointer group"
                >
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleAiPanel(idea.id); }}
                      className={cn(
                        "h-7 w-7 rounded-lg flex items-center justify-center transition-colors shadow-sm",
                        expandedIdeaId === idea.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border text-primary/70 hover:text-primary hover:border-primary/50"
                      )}
                      aria-label="Sugestões de IA"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlePromoteToPost(idea); }}
                      disabled={!!idea.promoted_to_post_id || promoteToPost.isPending}
                      title={idea.promoted_to_post_id ? "Já virou post" : "Virar post"}
                      className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors shadow-sm bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Virar post"
                    >
                      <Clapperboard className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {pillar && (
                    <div
                      className="w-full h-24 rounded-lg mb-3"
                      style={{ backgroundColor: pillar.color }}
                    />
                  )}
                  <h3 className={cn("font-display font-semibold text-sm text-foreground line-clamp-2 mb-2", !pillar && "pr-16")}>
                    {idea.title}
                  </h3>
                  {idea.notes && (
                    <p className="text-xs font-body text-muted-foreground line-clamp-3 mb-3 whitespace-pre-line">
                      {idea.notes}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const pasta = folders.find(f => f.id === folderIdDaIdeia(idea));
                      return pasta ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-body font-medium"
                          style={{ backgroundColor: `${pasta.color}1c`, color: pasta.color }}>
                          <Folder className="h-2.5 w-2.5" /> {pasta.name}
                        </span>
                      ) : null;
                    })()}
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

                  {expandedIdeaId === idea.id && (
                    <AnimatePresence initial={false}>
                      <motion.div
                        key={`ai-gallery-${idea.id}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden mt-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-3">
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
                                  key={`${idea.id}-gal-sug-${i}`}
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.05 }}
                                  className="bg-card border border-primary/20 rounded-xl p-3 space-y-2"
                                >
                                  <p className="text-sm font-body font-medium text-foreground leading-snug">{s.titulo}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-body bg-primary/10 text-primary capitalize">{s.formato}</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-body bg-secondary/10 text-secondary capitalize">{s.angulo}</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-body bg-muted text-muted-foreground capitalize">{s.objetivo}</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full h-7 text-xs"
                                    onClick={() => handleCreateFromSuggestion(s, idea.id)}
                                    disabled={createPost.isPending}
                                  >
                                    Criar post com essa ideia
                                  </Button>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {mainTab === "ideias" && filtered.length > 0 && viewMode === "list" && (
        <div className="bg-card border border-border rounded-xl divide-y divide-border/30 overflow-hidden">
          {filtered.map(idea => {
            const isExpanded = expandedIdeaId === idea.id;
            const pillar = idea.pillar_id ? pillars.find(p => p.id === idea.pillar_id) : null;
            return (
              <div key={idea.id}>
                <div className="px-3 sm:px-4 py-3 hover:bg-accent/30 group transition-colors">
                  <div onClick={() => openEdit(idea)} className="flex items-center gap-3 cursor-pointer">
                    <div className="w-5 h-5 rounded border-2 border-border shrink-0 group-hover:border-primary/50 transition-colors" />
                    <p className="font-body text-sm text-foreground flex-1 truncate">{idea.title}</p>
                    <div className="hidden sm:flex gap-1 shrink-0">
                      {(() => {
                        const pasta = folders.find(f => f.id === folderIdDaIdeia(idea));
                        return pasta ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-body whitespace-nowrap"
                            style={{ backgroundColor: `${pasta.color}1c`, color: pasta.color }}>
                            <Folder className="h-2.5 w-2.5" /> {pasta.name}
                          </span>
                        ) : null;
                      })()}
                      {pillar && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-body whitespace-nowrap"
                          style={{ backgroundColor: `${pillar.color}20`, color: pillar.color }}>{pillar.name}</span>
                      )}
                      {idea.promoted_to_post_id && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-body whitespace-nowrap">✓ Post</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleAiPanel(idea.id); }}
                      className={cn("flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-body transition-colors",
                        isExpanded ? "bg-primary/15 text-primary" : "hover:bg-accent text-primary/80 hover:text-primary")}>
                      <Sparkles className="h-3.5 w-3.5" /> IA
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handlePromoteToPost(idea); }}
                      disabled={!!idea.promoted_to_post_id || promoteToPost.isPending}
                      className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-body hover:bg-accent text-muted-foreground hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed">
                      <Clapperboard className="h-3.5 w-3.5" /> {idea.promoted_to_post_id ? "Já é post" : "Virar post"}
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(idea); }}
                      className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-body hover:bg-accent text-muted-foreground hover:text-foreground">
                      <Edit2 className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: idea.id, title: idea.title }); }}
                      className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-body hover:bg-destructive/10 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
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
        <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>{editingIdea ? "Editar Ideia" : "Nova Ideia"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(handleSave)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Título</Label>
              {/* Textarea, não Input: título de ideia colado do ChatGPT é uma
                  frase inteira e no Input só dava pra ler o comecinho. */}
              <Textarea {...register("title")} placeholder="Sua ideia..." className="min-h-[60px]" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            {pillars.length > 0 && (
              <div className="space-y-2">
                <Label>Pilar de conteúdo</Label>
                <div className="flex flex-wrap gap-1.5">
                  {pillars.map((p) => {
                    const ativo = pilarEscolhido === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setValue("pillar_id", ativo ? "" : p.id, { shouldDirty: true })}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-body border transition-colors",
                          ativo ? "border-transparent font-semibold" : "border-border bg-background text-muted-foreground hover:text-foreground",
                        )}
                        style={ativo ? { backgroundColor: `${p.color}22`, color: p.color, borderColor: p.color } : undefined}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {folders.length > 0 && (
              <div className="space-y-2">
                <Label>Pasta</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setFormFolder(null)}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-body border transition-colors",
                      !formFolder ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border bg-background text-muted-foreground hover:text-foreground")}>
                    Sem pasta
                  </button>
                  {folders.map((f) => {
                    const ativa = formFolder === f.id;
                    return (
                      <button key={f.id} type="button" onClick={() => setFormFolder(ativa ? null : f.id)}
                        className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-body border transition-colors",
                          ativa ? "border-transparent font-semibold" : "border-border bg-background text-muted-foreground hover:text-foreground")}
                        style={ativa ? { backgroundColor: `${f.color}22`, color: f.color, borderColor: f.color } : undefined}>
                        <Folder className="h-3 w-3" style={{ color: f.color }} /> {f.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
          userId={activeAccountId || user?.id || ""}
          onSaved={() => { /* React Query invalidations handle refresh */ }}
        />
      )}

      {/* Gerenciar pastas: criar (nome + cor), renomear no blur e excluir.
          Excluir NÃO apaga as ideias, elas voltam pra "Todas". */}
      <Dialog open={pastasOpen} onOpenChange={setPastasOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Pastas de ideias</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input value={novaPastaNome} onChange={(e) => setNovaPastaNome(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleCriarPasta(); } }}
                  placeholder="Nova pasta (ex.: Reels, Colabs...)" className="rounded-xl text-sm" />
                <Button type="button" variant="hero" size="sm" onClick={() => void handleCriarPasta()}
                  disabled={!novaPastaNome.trim() || criarPasta.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                {CORES_PASTA.map(c => (
                  <button key={c} type="button" onClick={() => setNovaPastaCor(c)}
                    className={cn("w-6 h-6 rounded-full transition-all", novaPastaCor === c && "ring-2 ring-offset-2 ring-primary")}
                    style={{ backgroundColor: c }} aria-label={`Cor ${c}`} />
                ))}
              </div>
            </div>
            {folders.length > 0 && (
              <div className="space-y-1.5">
                {folders.map(f => (
                  <div key={f.id} className="flex items-center gap-2 rounded-xl border border-border px-2.5 py-1.5">
                    <Folder className="h-4 w-4 shrink-0" style={{ color: f.color }} />
                    <Input defaultValue={f.name}
                      onBlur={(e) => { const nome = e.target.value.trim(); if (nome && nome !== f.name) renomearPasta.mutate({ id: f.id, name: nome }); }}
                      className="h-8 border-0 shadow-none px-1 text-sm font-body focus-visible:ring-1" />
                    <span className="text-[11px] text-muted-foreground font-body shrink-0">{contagemPorPasta[f.id] ?? 0}</span>
                    <button type="button"
                      onClick={() => { excluirPasta.mutate(f.id); if (activeFolder === f.id) setActiveFolder(null); }}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      aria-label={`Excluir pasta ${f.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground font-body">Excluir uma pasta não apaga as ideias: elas voltam pra "Todas".</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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

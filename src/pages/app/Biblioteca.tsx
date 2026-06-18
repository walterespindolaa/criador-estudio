import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, MessageSquareText, FileCode2, Zap, Plus, Pencil, Trash2, Star, StarOff, CheckCircle2, BookOpen, LayoutTemplate, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { usePosts } from "@/hooks/usePosts";
import { POST_TEMPLATES, TEMPLATE_CATEGORIES, type PostTemplate } from "@/lib/post-templates";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/CopyButton";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useReferenceLibrary,
  useUserLibrary,
  type LibraryItemType,
  type LibraryUserTable,
} from "@/hooks/useLibrary";

type SheetType = "hook" | "format" | "prompt";
type Source = "curados" | "meus";

type FormData = {
  hook_text?: string;
  category?: string;
  platforms?: string[] | null;
  name?: string;
  platform?: string;
  structure?: string;
  tips?: string;
  title?: string;
  prompt_text?: string;
  tip?: string;
  is_favorite?: boolean;
};

const HOOK_CATEGORIES = ["curiosidade", "identificação", "contraste", "dor", "promessa", "polêmica", "storytelling", "problema", "revelação", "desafio", "como fazer", "motivação", "autoridade", "resultado", "ação"];

const Biblioteca = () => {
  const { referenceHooks, referenceFormats, referencePrompts } = useReferenceLibrary();
  const {
    userHooks, userFormats, userPrompts, libraryUsage,
    saveUserHook, saveUserFormat, saveUserPrompt,
    deleteLibraryItem, toggleFavorite: toggleFavoriteMutation, toggleUsage,
  } = useUserLibrary();

  const usageMap = useMemo(() => {
    const map: Record<string, { item_id: string; used_at: string }> = {};
    libraryUsage.forEach(u => {
      map[u.item_id] = { item_id: u.item_id, used_at: u.used_at ?? new Date().toISOString() };
    });
    return map;
  }, [libraryUsage]);

  const [hookFilter, setHookFilter] = useState<string | null>(null);
  const [viralFilter, setViralFilter] = useState<string | null>(null);
  const [promptFilter, setPromptFilter] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [templateFilter, setTemplateFilter] = useState<"all" | PostTemplate["category"]>("all");
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const navigate = useNavigate();
  const { createPost } = usePosts();
  const filteredTemplates = useMemo(
    () => (templateFilter === "all" ? POST_TEMPLATES : POST_TEMPLATES.filter((t) => t.category === templateFilter)),
    [templateFilter]
  );

  const [hookSource, setHookSource] = useState<Source>("curados");
  const [formatSource, setFormatSource] = useState<Source>("curados");
  const [promptSource, setPromptSource] = useState<Source>("curados");
  const [viralSource, setViralSource] = useState<Source>("curados");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<SheetType>("hook");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({});

  const handleToggleUsage = async (itemType: LibraryItemType, itemId: string, isUserItem: boolean) => {
    try {
      await toggleUsage.mutateAsync({ itemType, itemId, isUserItem });
    } catch {
      toast.error("Erro ao registrar uso.");
    }
  };

  const UsageButton = ({ itemType, itemId, isUserItem }: { itemType: LibraryItemType; itemId: string; isUserItem: boolean }) => {
    const usage = usageMap[itemId];
    return (
      <button
        onClick={(e) => { e.stopPropagation(); handleToggleUsage(itemType, itemId, isUserItem); }}
        className={`flex items-center gap-1 text-[10px] font-body transition-colors ${
          usage ? "text-secondary" : "text-muted-foreground hover:text-foreground"
        }`}
        title={usage ? `Usado em ${new Date(usage.used_at).toLocaleDateString("pt-BR")}` : "Marcar como usado"}
      >
        <CheckCircle2 className={`h-3.5 w-3.5 ${usage ? "fill-secondary text-secondary" : ""}`} />
        {usage ? new Date(usage.used_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "Usado"}
      </button>
    );
  };

  const viralCategories = ["curiosidade", "problema", "revelação", "desafio", "como fazer", "storytelling", "motivação", "autoridade", "resultado", "ação"];
  const classicCategories = ["curiosidade", "identificação", "contraste", "dor", "promessa", "polêmica"];

  const viralHooks = referenceHooks.filter(h => viralCategories.includes(h.category));
  const viralCats = [...new Set(viralHooks.map(h => h.category))];
  const filteredViral = viralFilter ? viralHooks.filter(h => h.category === viralFilter) : viralHooks;
  const userViralHooks = userHooks.filter(h => viralCategories.includes(h.category));
  const filteredUserViral = viralFilter ? userViralHooks.filter(h => h.category === viralFilter) : userViralHooks;

  const promptCats = [...new Set(referencePrompts.map(p => p.category))];
  const formatPlatforms = [...new Set(referenceFormats.map(f => f.platform))];

  const openSheet = (type: SheetType, item?: FormData & { id?: string }) => {
    setSheetType(type);
    setEditingId(item?.id || null);
    setFormData(item ? { ...item } : {});
    setSheetOpen(true);
  };

  const saveItem = async () => {
    try {
      if (sheetType === "hook") {
        if (!formData.hook_text?.trim() || !formData.category) { toast.error("Preencha os campos."); return; }
        if (editingId) {
          await saveUserHook.mutateAsync({
            mode: "update",
            id: editingId,
            values: {
              hook_text: formData.hook_text,
              category: formData.category,
              platforms: formData.platforms ?? null,
            },
          });
        } else {
          await saveUserHook.mutateAsync({
            mode: "create",
            values: {
              hook_text: formData.hook_text,
              category: formData.category,
              platforms: formData.platforms ?? null,
            },
          });
        }
      } else if (sheetType === "format") {
        if (!formData.name?.trim() || !formData.platform || !formData.structure?.trim()) { toast.error("Preencha os campos."); return; }
        if (editingId) {
          await saveUserFormat.mutateAsync({
            mode: "update",
            id: editingId,
            values: {
              name: formData.name,
              platform: formData.platform,
              structure: formData.structure,
              tips: formData.tips || null,
            },
          });
        } else {
          await saveUserFormat.mutateAsync({
            mode: "create",
            values: {
              name: formData.name,
              platform: formData.platform,
              structure: formData.structure,
              tips: formData.tips || null,
            },
          });
        }
      } else {
        if (!formData.title?.trim() || !formData.prompt_text?.trim() || !formData.category) { toast.error("Preencha os campos."); return; }
        if (editingId) {
          await saveUserPrompt.mutateAsync({
            mode: "update",
            id: editingId,
            values: {
              title: formData.title,
              category: formData.category,
              prompt_text: formData.prompt_text,
              tip: formData.tip || null,
            },
          });
        } else {
          await saveUserPrompt.mutateAsync({
            mode: "create",
            values: {
              title: formData.title,
              category: formData.category,
              prompt_text: formData.prompt_text,
              tip: formData.tip || null,
            },
          });
        }
      }
      toast.success(editingId ? "Atualizado!" : "Adicionado!");
      setSheetOpen(false);
    } catch {
      toast.error("Erro ao salvar.");
    }
  };

  const deleteItem = async (type: SheetType, id: string) => {
    const table: LibraryUserTable = type === "hook" ? "user_hooks" : type === "format" ? "user_formats" : "user_prompts";
    try {
      await deleteLibraryItem.mutateAsync({ table, id });
      toast.success("Removido!");
    } catch {
      toast.error("Erro ao remover.");
    }
  };

  const toggleFavorite = async (type: "hook" | "prompt", id: string, current: boolean) => {
    const table = type === "hook" ? "user_hooks" : "user_prompts";
    try {
      await toggleFavoriteMutation.mutateAsync({ table, id, is_favorite: !current });
    } catch {
      toast.error("Erro ao favoritar.");
    }
  };

  const SourceToggle = ({ source, setSource }: { source: Source; setSource: (v: Source) => void }) => (
    <div className="flex gap-1 mb-4">
      <button onClick={() => setSource("curados")} className={`px-3 py-1 rounded-lg text-xs font-body border transition-colors ${source === "curados" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Curados</button>
      <button onClick={() => setSource("meus")} className={`px-3 py-1 rounded-lg text-xs font-body border transition-colors ${source === "meus" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Meus</button>
    </div>
  );

  const sortByFavorite = <T extends { is_favorite?: boolean | null }>(arr: T[]) =>
    [...arr].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));

  return (
    <div className="max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-8 md:hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm shrink-0">
            <BookOpen className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Biblioteca</h1>
            <p className="text-muted-foreground font-body mt-0.5 text-sm">Referências prontas para turbinar seu conteúdo.</p>
          </div>
        </div>

        <Tabs defaultValue="hooks">
          <div className="overflow-x-auto scrollbar-none -mx-4 px-4 mb-6">
            <TabsList className="bg-card border border-border rounded-xl flex-nowrap whitespace-nowrap h-auto gap-1 p-1 w-max">
              <TabsTrigger value="hooks" className="shrink-0 rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Hooks <InfoTooltip text="Primeiras frases que capturam atenção. Use como ponto de partida do seu roteiro ou legenda." className="ml-1" />
              </TabsTrigger>
              <TabsTrigger value="formatos" className="shrink-0 rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <FileCode2 className="h-3.5 w-3.5 mr-1" /> Formatos <InfoTooltip text="Estruturas de conteúdo que funcionam bem em cada plataforma." className="ml-1" />
              </TabsTrigger>
              <TabsTrigger value="prompts" className="shrink-0 rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <MessageSquareText className="h-3.5 w-3.5 mr-1" /> Prompts <InfoTooltip text="Comandos prontos para IA. Preencha os [COLCHETES] com suas informações." className="ml-1" />
              </TabsTrigger>
              <TabsTrigger value="viral" className="shrink-0 rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Zap className="h-3.5 w-3.5 mr-1" /> Ideias Virais <InfoTooltip text="Hooks e ganchos que performam bem em múltiplas plataformas. Adapte ao seu nicho." className="ml-1" />
              </TabsTrigger>
              <TabsTrigger value="templates" className="shrink-0 rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <LayoutTemplate className="h-3.5 w-3.5 mr-1" /> Templates <InfoTooltip text="Modelos prontos de legenda. Copie e personalize ou crie um post direto a partir do template." className="ml-1" />
              </TabsTrigger>
            </TabsList>
          </div>

          {/* HOOKS */}
          <TabsContent value="hooks">
            <SourceToggle source={hookSource} setSource={setHookSource} />
            {hookSource === "meus" && (
              <button onClick={() => openSheet("hook")} className="mb-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-body bg-primary text-primary-foreground">
                <Plus className="h-3 w-3" /> Adicionar hook
              </button>
            )}
            <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto">
              <button onClick={() => setHookFilter(null)} className={`px-3 py-1 rounded-xl text-xs font-body border transition-colors whitespace-nowrap ${!hookFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Todos</button>
              {classicCategories.map(cat => (
                <button key={cat} onClick={() => setHookFilter(hookFilter === cat ? null : cat)} className={`px-3 py-1 rounded-xl text-xs font-body border capitalize transition-colors whitespace-nowrap ${hookFilter === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {hookSource === "curados"
                ? referenceHooks.filter(h => classicCategories.includes(h.category)).filter(h => !hookFilter || h.category === hookFilter).map((h, i) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-card rounded-xl p-4 shadow-[var(--shadow-warm)] border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-primary/10 text-primary capitalize">{h.category}</span>
                      <CopyButton text={h.hook_text} />
                    </div>
                    <p className="text-sm font-body text-foreground">"{h.hook_text}"</p>
                    <div className="flex items-center justify-between mt-2">
                      {h.platforms && <div className="flex gap-2">{h.platforms.map(p => <PlatformIcon key={p} platform={p} size="sm" />)}</div>}
                      <UsageButton itemType="hook" itemId={h.id} isUserItem={false} />
                    </div>
                  </motion.div>
                ))
                : sortByFavorite(userHooks.filter(h => classicCategories.includes(h.category)).filter(h => !hookFilter || h.category === hookFilter)).map((h, i) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-card rounded-xl p-4 shadow-[var(--shadow-warm)] border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-primary/10 text-primary capitalize">{h.category}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleFavorite("hook", h.id, !!h.is_favorite)}>{h.is_favorite ? <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}</button>
                        <button onClick={() => openSheet("hook", h)}><Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                        <button onClick={() => deleteItem("hook", h.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        <CopyButton text={h.hook_text} />
                      </div>
                    </div>
                    <p className="text-sm font-body text-foreground">"{h.hook_text}"</p>
                    <div className="flex justify-end mt-2">
                      <UsageButton itemType="hook" itemId={h.id} isUserItem={true} />
                    </div>
                  </motion.div>
                ))
              }
            </div>
          </TabsContent>

          {/* FORMATOS */}
          <TabsContent value="formatos">
            <SourceToggle source={formatSource} setSource={setFormatSource} />
            {formatSource === "meus" && (
              <button onClick={() => openSheet("format")} className="mb-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-body bg-primary text-primary-foreground">
                <Plus className="h-3 w-3" /> Adicionar formato
              </button>
            )}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setFormatFilter(null)} className={`px-3 py-1 rounded-xl text-xs font-body border transition-colors ${!formatFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Todos</button>
              {formatPlatforms.map(p => (
                <button key={p} onClick={() => setFormatFilter(formatFilter === p ? null : p)} className={`px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1.5 ${formatFilter === p ? "bg-primary/10 border-primary" : "bg-card border-border"}`}>
                  <PlatformIcon platform={p} size="sm" />
                  <span className="text-xs font-body capitalize">{p}</span>
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {formatSource === "curados"
                ? (formatFilter ? referenceFormats.filter(f => f.platform === formatFilter) : referenceFormats).map((f, i) => (
                  <motion.div key={f.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="bg-card rounded-xl p-5 shadow-[var(--shadow-warm)] border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <PlatformIcon platform={f.platform} size="sm" />
                      <span className="font-body font-semibold text-sm text-foreground">{f.name}</span>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-body bg-muted text-muted-foreground">{f.format_type}</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 mb-2"><p className="text-sm font-body text-foreground font-mono">{f.structure}</p></div>
                    <div className="flex items-center justify-between">
                      {f.tips && <p className="text-xs text-muted-foreground font-body flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> {f.tips}</p>}
                      <UsageButton itemType="format" itemId={f.id} isUserItem={false} />
                    </div>
                  </motion.div>
                ))
                : userFormats.filter(f => !formatFilter || f.platform === formatFilter).map((f, i) => (
                  <motion.div key={f.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="bg-card rounded-xl p-5 shadow-[var(--shadow-warm)] border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={f.platform} size="sm" />
                        <span className="font-body font-semibold text-sm text-foreground">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openSheet("format", f)}><Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                        <button onClick={() => deleteItem("format", f.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 mb-2"><p className="text-sm font-body text-foreground font-mono">{f.structure}</p></div>
                    <div className="flex items-center justify-between">
                      {f.tips && <p className="text-xs text-muted-foreground font-body flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> {f.tips}</p>}
                      <UsageButton itemType="format" itemId={f.id} isUserItem={true} />
                    </div>
                  </motion.div>
                ))
              }
              {((formatSource === "curados" ? referenceFormats : userFormats).length === 0) && (
                <div className="bg-card rounded-xl p-12 shadow-[var(--shadow-warm)] border border-border text-center">
                  <FileCode2 className="h-8 w-8 text-primary mx-auto mb-3" />
                  <p className="text-muted-foreground font-body">Nenhum formato encontrado.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* PROMPTS */}
          <TabsContent value="prompts">
            <SourceToggle source={promptSource} setSource={setPromptSource} />
            {promptSource === "meus" && (
              <button onClick={() => openSheet("prompt")} className="mb-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-body bg-primary text-primary-foreground">
                <Plus className="h-3 w-3" /> Adicionar prompt
              </button>
            )}
            <p className="text-sm text-muted-foreground font-body mb-4">
              Copie, preencha os <span className="text-primary font-medium">[COLCHETES]</span> e cole no ChatGPT ou Claude
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => setPromptFilter(null)} className={`px-3 py-1 rounded-xl text-xs font-body border transition-colors ${!promptFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Todos</button>
              {promptCats.map(cat => (
                <button key={cat} onClick={() => setPromptFilter(promptFilter === cat ? null : cat)} className={`px-3 py-1 rounded-xl text-xs font-body border capitalize transition-colors ${promptFilter === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>{cat}</button>
              ))}
            </div>
            <div className="space-y-3">
              {promptSource === "curados"
                ? (promptFilter ? referencePrompts.filter(p => p.category === promptFilter) : referencePrompts).map((p, i) => (
                  <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="bg-card rounded-xl p-5 shadow-[var(--shadow-warm)] border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-secondary/10 text-secondary capitalize mr-2">{p.category}</span>
                        <span className="font-body font-semibold text-sm text-foreground">{p.title}</span>
                      </div>
                      <CopyButton text={p.prompt_text} />
                    </div>
                    <p className="text-sm text-foreground font-body leading-relaxed mb-2">
                      {p.prompt_text.split(/(\[[^\]]+\])/).map((part, j) =>
                        part.startsWith("[") ? <span key={j} className="text-primary font-medium">{part}</span> : <span key={j}>{part}</span>
                      )}
                    </p>
                    <div className="flex items-center justify-between">
                      {p.tip && <p className="text-xs text-muted-foreground font-body flex items-center gap-1"><Sparkles className="h-3 w-3" /> {p.tip}</p>}
                      <UsageButton itemType="prompt" itemId={p.id} isUserItem={false} />
                    </div>
                  </motion.div>
                ))
                : sortByFavorite(promptFilter ? userPrompts.filter(p => p.category === promptFilter) : userPrompts).map((p, i) => (
                  <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="bg-card rounded-xl p-5 shadow-[var(--shadow-warm)] border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-secondary/10 text-secondary capitalize mr-2">{p.category}</span>
                        <span className="font-body font-semibold text-sm text-foreground">{p.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleFavorite("prompt", p.id, !!p.is_favorite)}>{p.is_favorite ? <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}</button>
                        <button onClick={() => openSheet("prompt", p)}><Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                        <button onClick={() => deleteItem("prompt", p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        <CopyButton text={p.prompt_text} />
                      </div>
                    </div>
                    <p className="text-sm text-foreground font-body leading-relaxed mb-2">{p.prompt_text}</p>
                    <div className="flex items-center justify-between">
                      {p.tip && <p className="text-xs text-muted-foreground font-body flex items-center gap-1"><Sparkles className="h-3 w-3" /> {p.tip}</p>}
                      <UsageButton itemType="prompt" itemId={p.id} isUserItem={true} />
                    </div>
                  </motion.div>
                ))
              }
            </div>
          </TabsContent>

          {/* IDEIAS VIRAIS */}
          <TabsContent value="viral">
            <SourceToggle source={viralSource} setSource={setViralSource} />
            {viralSource === "meus" && (
              <button onClick={() => { openSheet("hook", { category: "curiosidade" }); }} className="mb-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-body bg-primary text-primary-foreground">
                <Plus className="h-3 w-3" /> Adicionar ideia viral
              </button>
            )}
            <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto">
              <button onClick={() => setViralFilter(null)} className={`px-3 py-1 rounded-xl text-xs font-body border transition-colors whitespace-nowrap ${!viralFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Todos</button>
              {viralCats.map(cat => (
                <button key={cat} onClick={() => setViralFilter(viralFilter === cat ? null : cat)} className={`px-3 py-1 rounded-xl text-xs font-body border capitalize transition-colors whitespace-nowrap ${viralFilter === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {viralSource === "curados"
                ? filteredViral.map((h, i) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-card rounded-xl p-4 shadow-[var(--shadow-warm)] border border-border bg-gradient-to-br from-amber-50/30 to-transparent dark:from-amber-900/10">
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 capitalize">{h.category}</span>
                      <CopyButton text={h.hook_text} />
                    </div>
                    <p className="text-sm font-body text-foreground">"{h.hook_text}"</p>
                    <div className="flex justify-end mt-2">
                      <UsageButton itemType="hook" itemId={h.id} isUserItem={false} />
                    </div>
                  </motion.div>
                ))
                : sortByFavorite(filteredUserViral).map((h, i) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-card rounded-xl p-4 shadow-[var(--shadow-warm)] border border-border bg-gradient-to-br from-amber-50/30 to-transparent dark:from-amber-900/10">
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 capitalize">{h.category}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleFavorite("hook", h.id, !!h.is_favorite)}>{h.is_favorite ? <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}</button>
                        <button onClick={() => openSheet("hook", h)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => deleteItem("hook", h.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        <CopyButton text={h.hook_text} />
                      </div>
                    </div>
                    <p className="text-sm font-body text-foreground">"{h.hook_text}"</p>
                    <div className="flex justify-end mt-2">
                      <UsageButton itemType="hook" itemId={h.id} isUserItem={true} />
                    </div>
                  </motion.div>
                ))
              }
            </div>
          </TabsContent>

          {/* TEMPLATES */}
          <TabsContent value="templates">
            <div className="flex gap-1.5 flex-wrap mb-6">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setTemplateFilter(cat.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all",
                    templateFilter === cat.key
                      ? "bg-primary/10 text-primary font-semibold"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span className="mr-1">{cat.icon}</span> {cat.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => {
                const isExpanded = expandedTemplate === template.id;
                return (
                <div
                  key={template.id}
                  onClick={() => setExpandedTemplate((prev) => (prev === template.id ? null : template.id))}
                  className="bg-card rounded-xl border border-border p-5 hover:shadow-warm-md transition-all group flex flex-col cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{template.icon}</span>
                    <h3 className="font-display font-semibold text-sm text-foreground">{template.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground font-body mb-3">{template.description}</p>

                  <div className="bg-muted/50 rounded-lg p-3 mb-3 flex-1">
                    <p
                      className={cn(
                        "text-xs font-body text-foreground/70 whitespace-pre-line",
                        !isExpanded && "line-clamp-4"
                      )}
                    >
                      {template.caption}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-body capitalize whitespace-nowrap">
                      {template.format}
                    </span>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(template.caption);
                          toast.success("Template copiado!");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copiar
                      </Button>
                      <Button
                        variant="hero"
                        size="sm"
                        className="text-xs h-8"
                        disabled={createPost.isPending}
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await createPost.mutateAsync({
                              title: template.title,
                              caption: template.caption,
                              format: template.format,
                              platform: "instagram",
                              status: "ideia",
                            });
                            toast.success("Post criado com template!");
                            navigate("/app/criando");
                          } catch {
                            toast.error("Erro ao criar post.");
                          }
                        }}
                      >
                        Usar template
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="bg-background">
          <SheetHeader>
            <SheetTitle className="font-display">
              {editingId ? "Editar" : "Adicionar"} {sheetType === "hook" ? "Hook" : sheetType === "format" ? "Formato" : "Prompt"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {sheetType === "hook" && (
              <>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Categoria</Label>
                  <Select value={formData.category || ""} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{HOOK_CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Texto do hook</Label>
                  <Textarea value={formData.hook_text || ""} onChange={e => setFormData(p => ({ ...p, hook_text: e.target.value }))} placeholder="Ex: Você sabia que..." className="rounded-xl" />
                </div>
              </>
            )}
            {sheetType === "format" && (
              <>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Nome</Label>
                  <Input value={formData.name || ""} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Carrossel educativo" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Plataforma</Label>
                  <Select value={formData.platform || ""} onValueChange={v => setFormData(p => ({ ...p, platform: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Estrutura</Label>
                  <Textarea value={formData.structure || ""} onChange={e => setFormData(p => ({ ...p, structure: e.target.value }))} placeholder="Descreva a estrutura..." className="rounded-xl min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Dicas (opcional)</Label>
                  <Input value={formData.tips || ""} onChange={e => setFormData(p => ({ ...p, tips: e.target.value }))} className="rounded-xl" />
                </div>
              </>
            )}
            {sheetType === "prompt" && (
              <>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Categoria</Label>
                  <Select value={formData.category || ""} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {["ideia", "legenda", "roteiro", "reels", "carrossel", "storytelling", "geral"].map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Título</Label>
                  <Input value={formData.title || ""} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Texto do prompt</Label>
                  <Textarea value={formData.prompt_text || ""} onChange={e => setFormData(p => ({ ...p, prompt_text: e.target.value }))} placeholder="Use [COLCHETES] para variáveis..." className="rounded-xl min-h-[120px]" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Dica (opcional)</Label>
                  <Input value={formData.tip || ""} onChange={e => setFormData(p => ({ ...p, tip: e.target.value }))} className="rounded-xl" />
                </div>
              </>
            )}
            <Button variant="hero" className="w-full" onClick={saveItem}>
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Biblioteca;

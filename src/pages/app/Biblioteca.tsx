import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, MessageSquareText, FileCode2, Zap, Plus, Pencil, Trash2, Star, StarOff, CheckCircle2 } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/CopyButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Hook { id: string; hook_text: string; category: string; platforms: string[] | null; }
interface Format { id: string; name: string; platform: string; format_type: string; structure: string; tips: string | null; }
interface Prompt { id: string; title: string; category: string; prompt_text: string; tip: string | null; }
interface UserHook { id: string; hook_text: string; category: string; platforms: string[] | null; is_favorite: boolean; }
interface UserFormat { id: string; name: string; platform: string; structure: string; tips: string | null; }
interface UserPrompt { id: string; title: string; category: string; prompt_text: string; tip: string | null; is_favorite: boolean; }
interface UsageRecord { item_id: string; used_at: string; }

const HOOK_CATEGORIES = ["curiosidade", "identificação", "contraste", "dor", "promessa", "polêmica", "storytelling", "problema", "revelação", "desafio", "como fazer", "motivação", "autoridade", "resultado", "ação"];

const Biblioteca = () => {
  const { user } = useAuth();
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [userHooks, setUserHooks] = useState<UserHook[]>([]);
  const [userFormats, setUserFormats] = useState<UserFormat[]>([]);
  const [userPrompts, setUserPrompts] = useState<UserPrompt[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, UsageRecord>>({});
  
  // Filters
  const [hookFilter, setHookFilter] = useState<string | null>(null);
  const [viralFilter, setViralFilter] = useState<string | null>(null);
  const [promptFilter, setPromptFilter] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  
  // Toggle curated vs personal
  const [hookSource, setHookSource] = useState<"curados" | "meus">("curados");
  const [formatSource, setFormatSource] = useState<"curados" | "meus">("curados");
  const [promptSource, setPromptSource] = useState<"curados" | "meus">("curados");
  const [viralSource, setViralSource] = useState<"curados" | "meus">("curados");

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<"hook" | "format" | "prompt">("hook");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("reference_hooks").select("*").eq("is_active", true),
      supabase.from("reference_formats").select("*").eq("is_active", true),
      supabase.from("reference_prompts").select("*").eq("is_active", true).order("position"),
      supabase.from("user_hooks").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("user_formats").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("user_prompts").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("user_library_usage" as any).select("*").eq("user_id", user.id),
    ]).then(([hooksRes, formatsRes, promptsRes, uHooksRes, uFormatsRes, uPromptsRes, usageRes]) => {
      setHooks(hooksRes.data || []);
      setFormats(formatsRes.data || []);
      setPrompts(promptsRes.data || []);
      setUserHooks((uHooksRes.data as any[]) || []);
      setUserFormats((uFormatsRes.data as any[]) || []);
      setUserPrompts((uPromptsRes.data as any[]) || []);
      const map: Record<string, UsageRecord> = {};
      ((usageRes.data as any[]) || []).forEach((u: any) => { map[u.item_id] = { item_id: u.item_id, used_at: u.used_at }; });
      setUsageMap(map);
    });
  }, [user]);

  const toggleUsage = async (itemType: string, itemId: string) => {
    if (!user) return;
    if (usageMap[itemId]) {
      await supabase.from("user_library_usage" as any).delete().eq("user_id", user.id).eq("item_id", itemId);
      setUsageMap(prev => { const next = { ...prev }; delete next[itemId]; return next; });
    } else {
      const { data } = await supabase.from("user_library_usage" as any).insert({ user_id: user.id, item_type: itemType, item_id: itemId } as any).select().single();
      if (data) setUsageMap(prev => ({ ...prev, [itemId]: { item_id: itemId, used_at: (data as any).used_at } }));
    }
  };

  const UsageButton = ({ itemType, itemId }: { itemType: string; itemId: string }) => {
    const usage = usageMap[itemId];
    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggleUsage(itemType, itemId); }}
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
  
  const viralHooks = hooks.filter(h => viralCategories.includes(h.category));
  const viralCats = [...new Set(viralHooks.map(h => h.category))];
  const filteredViral = viralFilter ? viralHooks.filter(h => h.category === viralFilter) : viralHooks;
  const userViralHooks = userHooks.filter(h => viralCategories.includes(h.category));
  const filteredUserViral = viralFilter ? userViralHooks.filter(h => h.category === viralFilter) : userViralHooks;

  const promptCats = [...new Set(prompts.map(p => p.category))];
  const formatPlatforms = [...new Set(formats.map(f => f.platform))];

  // CRUD helpers
  const openSheet = (type: "hook" | "format" | "prompt", item?: any) => {
    setSheetType(type);
    setEditingId(item?.id || null);
    setFormData(item ? { ...item } : {});
    setSheetOpen(true);
  };

  const saveItem = async () => {
    if (!user) return;
    
    if (sheetType === "hook") {
      if (!formData.hook_text?.trim() || !formData.category) { toast.error("Preencha os campos."); return; }
      const payload = { user_id: user.id, hook_text: formData.hook_text as string, category: formData.category as string, platforms: formData.platforms || null };
      if (editingId) {
        await supabase.from("user_hooks").update(payload).eq("id", editingId);
      } else {
        await supabase.from("user_hooks").insert(payload);
      }
      const { data } = await supabase.from("user_hooks").select("*").eq("user_id", user.id).order("created_at");
      setUserHooks((data as any[]) || []);
    } else if (sheetType === "format") {
      if (!formData.name?.trim() || !formData.platform || !formData.structure?.trim()) { toast.error("Preencha os campos."); return; }
      const payload = { user_id: user.id, name: formData.name as string, platform: formData.platform as string, structure: formData.structure as string, tips: (formData.tips as string) || null };
      if (editingId) {
        await supabase.from("user_formats").update(payload).eq("id", editingId);
      } else {
        await supabase.from("user_formats").insert(payload);
      }
      const { data } = await supabase.from("user_formats").select("*").eq("user_id", user.id).order("created_at");
      setUserFormats((data as any[]) || []);
    } else {
      if (!formData.title?.trim() || !formData.prompt_text?.trim() || !formData.category) { toast.error("Preencha os campos."); return; }
      const payload = { user_id: user.id, title: formData.title as string, category: formData.category as string, prompt_text: formData.prompt_text as string, tip: (formData.tip as string) || null };
      if (editingId) {
        await supabase.from("user_prompts").update(payload).eq("id", editingId);
      } else {
        await supabase.from("user_prompts").insert(payload);
      }
      const { data } = await supabase.from("user_prompts").select("*").eq("user_id", user.id).order("created_at");
      setUserPrompts((data as any[]) || []);
    }
    toast.success(editingId ? "Atualizado!" : "Adicionado!");
    setSheetOpen(false);
  };

  const deleteItem = async (type: "hook" | "format" | "prompt", id: string) => {
    const table = type === "hook" ? "user_hooks" : type === "format" ? "user_formats" : "user_prompts";
    await supabase.from(table).delete().eq("id", id);
    if (type === "hook") setUserHooks(prev => prev.filter(i => i.id !== id));
    if (type === "format") setUserFormats(prev => prev.filter(i => i.id !== id));
    if (type === "prompt") setUserPrompts(prev => prev.filter(i => i.id !== id));
    toast.success("Removido!");
  };

  const toggleFavorite = async (type: "hook" | "prompt", id: string, current: boolean) => {
    const table = type === "hook" ? "user_hooks" : "user_prompts";
    await supabase.from(table).update({ is_favorite: !current }).eq("id", id);
    if (type === "hook") setUserHooks(prev => prev.map(i => i.id === id ? { ...i, is_favorite: !current } : i));
    if (type === "prompt") setUserPrompts(prev => prev.map(i => i.id === id ? { ...i, is_favorite: !current } : i));
  };

  const SourceToggle = ({ source, setSource }: { source: string; setSource: (v: any) => void }) => (
    <div className="flex gap-1 mb-4">
      <button onClick={() => setSource("curados")} className={`px-3 py-1 rounded-lg text-xs font-body border transition-colors ${source === "curados" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Curados</button>
      <button onClick={() => setSource("meus")} className={`px-3 py-1 rounded-lg text-xs font-body border transition-colors ${source === "meus" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Meus</button>
    </div>
  );

  const sortByFavorite = <T extends { is_favorite?: boolean }>(arr: T[]) => 
    [...arr].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));

  return (
    <div className="max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Biblioteca</h1>
        <p className="text-muted-foreground font-body mb-8">Referências prontas para turbinar seu conteúdo.</p>

        <Tabs defaultValue="hooks">
          <TabsList className="bg-card border border-border rounded-xl mb-6 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="hooks" className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Hooks
            </TabsTrigger>
            <TabsTrigger value="formatos" className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <FileCode2 className="h-3.5 w-3.5 mr-1" /> Formatos
            </TabsTrigger>
            <TabsTrigger value="prompts" className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <MessageSquareText className="h-3.5 w-3.5 mr-1" /> Prompts
            </TabsTrigger>
            <TabsTrigger value="viral" className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Zap className="h-3.5 w-3.5 mr-1" /> Ideias Virais
            </TabsTrigger>
          </TabsList>

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
                ? hooks.filter(h => classicCategories.includes(h.category)).filter(h => !hookFilter || h.category === hookFilter).map((h, i) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-card rounded-xl p-4 shadow-[var(--shadow-warm)] border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-primary/10 text-primary capitalize">{h.category}</span>
                      <CopyButton text={h.hook_text} />
                    </div>
                    <p className="text-sm font-body text-foreground">"{h.hook_text}"</p>
                    <div className="flex items-center justify-between mt-2">
                      {h.platforms && <div className="flex gap-2">{h.platforms.map(p => <PlatformIcon key={p} platform={p as any} size="sm" />)}</div>}
                      <UsageButton itemType="hook" itemId={h.id} />
                    </div>
                  </motion.div>
                ))
                : sortByFavorite(userHooks.filter(h => classicCategories.includes(h.category)).filter(h => !hookFilter || h.category === hookFilter)).map((h, i) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-card rounded-xl p-4 shadow-[var(--shadow-warm)] border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-primary/10 text-primary capitalize">{h.category}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleFavorite("hook", h.id, h.is_favorite)}>{h.is_favorite ? <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}</button>
                        <button onClick={() => openSheet("hook", h)}><Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                        <button onClick={() => deleteItem("hook", h.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        <CopyButton text={h.hook_text} />
                      </div>
                    </div>
                    <p className="text-sm font-body text-foreground">"{h.hook_text}"</p>
                    <div className="flex justify-end mt-2">
                      <UsageButton itemType="hook" itemId={h.id} />
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
                  <PlatformIcon platform={p as any} size="sm" />
                  <span className="text-xs font-body capitalize">{p}</span>
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {formatSource === "curados"
                ? (formatFilter ? formats.filter(f => f.platform === formatFilter) : formats).map((f, i) => (
                  <motion.div key={f.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="bg-card rounded-xl p-5 shadow-[var(--shadow-warm)] border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <PlatformIcon platform={f.platform as any} size="sm" />
                      <span className="font-body font-semibold text-sm text-foreground">{f.name}</span>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-body bg-muted text-muted-foreground">{f.format_type}</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 mb-2"><p className="text-sm font-body text-foreground font-mono">{f.structure}</p></div>
                    <div className="flex items-center justify-between">
                      {f.tips && <p className="text-xs text-muted-foreground font-body flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> {f.tips}</p>}
                      <UsageButton itemType="format" itemId={f.id} />
                    </div>
                  </motion.div>
                ))
                : userFormats.filter(f => !formatFilter || f.platform === formatFilter).map((f, i) => (
                  <motion.div key={f.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="bg-card rounded-xl p-5 shadow-[var(--shadow-warm)] border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={f.platform as any} size="sm" />
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
                      <UsageButton itemType="format" itemId={f.id} />
                    </div>
                  </motion.div>
                ))
              }
              {((formatSource === "curados" ? formats : userFormats).length === 0) && (
                <div className="bg-card rounded-2xl p-12 shadow-[var(--shadow-warm)] border border-border text-center">
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
                ? (promptFilter ? prompts.filter(p => p.category === promptFilter) : prompts).map((p, i) => (
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
                      <UsageButton itemType="prompt" itemId={p.id} />
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
                        <button onClick={() => toggleFavorite("prompt", p.id, p.is_favorite)}>{p.is_favorite ? <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}</button>
                        <button onClick={() => openSheet("prompt", p)}><Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                        <button onClick={() => deleteItem("prompt", p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        <CopyButton text={p.prompt_text} />
                      </div>
                    </div>
                    <p className="text-sm text-foreground font-body leading-relaxed mb-2">{p.prompt_text}</p>
                    <div className="flex items-center justify-between">
                      {p.tip && <p className="text-xs text-muted-foreground font-body flex items-center gap-1"><Sparkles className="h-3 w-3" /> {p.tip}</p>}
                      <UsageButton itemType="prompt" itemId={p.id} />
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
              <button onClick={() => { setFormData({ category: "curiosidade" }); openSheet("hook"); }} className="mb-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-body bg-primary text-primary-foreground">
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
                      <UsageButton itemType="hook" itemId={h.id} />
                    </div>
                  </motion.div>
                ))
                : sortByFavorite(filteredUserViral).map((h, i) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-card rounded-xl p-4 shadow-[var(--shadow-warm)] border border-border bg-gradient-to-br from-amber-50/30 to-transparent dark:from-amber-900/10">
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 capitalize">{h.category}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleFavorite("hook", h.id, h.is_favorite)}>{h.is_favorite ? <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}</button>
                        <button onClick={() => openSheet("hook", h)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => deleteItem("hook", h.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        <CopyButton text={h.hook_text} />
                      </div>
                    </div>
                    <p className="text-sm font-body text-foreground">"{h.hook_text}"</p>
                    <div className="flex justify-end mt-2">
                      <UsageButton itemType="hook" itemId={h.id} />
                    </div>
                  </motion.div>
                ))
              }
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
                  <Select value={formData.category || ""} onValueChange={v => setFormData((p: any) => ({ ...p, category: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{HOOK_CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Texto do hook</Label>
                  <Textarea value={formData.hook_text || ""} onChange={e => setFormData((p: any) => ({ ...p, hook_text: e.target.value }))} placeholder="Ex: Você sabia que..." className="rounded-xl" />
                </div>
              </>
            )}
            {sheetType === "format" && (
              <>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Nome</Label>
                  <Input value={formData.name || ""} onChange={e => setFormData((p: any) => ({ ...p, name: e.target.value }))} placeholder="Ex: Carrossel educativo" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Plataforma</Label>
                  <Select value={formData.platform || ""} onValueChange={v => setFormData((p: any) => ({ ...p, platform: v }))}>
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
                  <Textarea value={formData.structure || ""} onChange={e => setFormData((p: any) => ({ ...p, structure: e.target.value }))} placeholder="Descreva a estrutura..." className="rounded-xl min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Dicas (opcional)</Label>
                  <Input value={formData.tips || ""} onChange={e => setFormData((p: any) => ({ ...p, tips: e.target.value }))} className="rounded-xl" />
                </div>
              </>
            )}
            {sheetType === "prompt" && (
              <>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Categoria</Label>
                  <Select value={formData.category || ""} onValueChange={v => setFormData((p: any) => ({ ...p, category: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {["ideia", "legenda", "roteiro", "reels", "carrossel", "storytelling", "geral"].map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Título</Label>
                  <Input value={formData.title || ""} onChange={e => setFormData((p: any) => ({ ...p, title: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Texto do prompt</Label>
                  <Textarea value={formData.prompt_text || ""} onChange={e => setFormData((p: any) => ({ ...p, prompt_text: e.target.value }))} placeholder="Use [COLCHETES] para variáveis..." className="rounded-xl min-h-[120px]" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Dica (opcional)</Label>
                  <Input value={formData.tip || ""} onChange={e => setFormData((p: any) => ({ ...p, tip: e.target.value }))} className="rounded-xl" />
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

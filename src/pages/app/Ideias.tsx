import { useEffect, useState } from "react";
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

const PLATFORMS = ["instagram", "tiktok", "youtube"] as const;

const OBJECTIVES = [
  { key: "engajamento", label: "Engajamento" },
  { key: "autoridade", label: "Autoridade" },
  { key: "venda", label: "Venda" },
  { key: "relacionamento", label: "Relacionamento" },
  { key: "prova_social", label: "Prova Social" },
  { key: "bastidor", label: "Bastidor" },
];

const ORIGINS = [
  { key: "criada", label: "Criei do zero" },
  { key: "referencia", label: "Veio de referência" },
  { key: "hook", label: "Veio de um hook" },
];

const IDEA_STATUSES = [
  { key: "nova", label: "Nova", color: "bg-blue-100 text-blue-700" },
  { key: "validada", label: "Validada", color: "bg-green-100 text-green-700" },
  { key: "em_producao", label: "Em produção", color: "bg-yellow-100 text-yellow-700" },
  { key: "usada", label: "Usada", color: "bg-gray-200 text-gray-600" },
  { key: "arquivada", label: "Arquivada", color: "bg-gray-100 text-gray-400" },
];

const AI_LIMIT = 10;

const getStatusBadge = (status: string | null) => {
  const s = IDEA_STATUSES.find(x => x.key === status) || IDEA_STATUSES[0];
  return s;
};

const getObjectiveLabel = (key: string | null) => OBJECTIVES.find(o => o.key === key)?.label;

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
  const [formTitle, setFormTitle] = useState("");
  const [formPillar, setFormPillar] = useState("");
  const [formPlatform, setFormPlatform] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formObjective, setFormObjective] = useState("");
  const [formOrigin, setFormOrigin] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [postDrawerOpen, setPostDrawerOpen] = useState(false);
  const [promotedPost, setPromotedPost] = useState<any>(null);

  // AI suggestions state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{
    titulo: string; formato: string; angulo?: string; objetivo: string;
  }>>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiUsed, setAiUsed] = useState(0);
  const [targetIdeaId, setTargetIdeaId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    const [ideasRes, pillarsRes, profileRes] = await Promise.all([
      supabase.from("ideas").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("pillars").select("*").eq("user_id", user.id).order("position"),
      supabase.from("profiles").select("ai_ideas_used_month, ai_ideas_reset_at").eq("id", user.id).single(),
    ]);
    setIdeas((ideasRes.data as any[]) || []);
    setPillars(pillarsRes.data || []);

    // Calculate AI usage
    const today = new Date().toISOString().split("T")[0];
    const resetAt = (profileRes.data as any)?.ai_ideas_reset_at || today;
    const resetMonth = String(resetAt).substring(0, 7);
    const currentMonth = today.substring(0, 7);
    setAiUsed(resetMonth === currentMonth ? ((profileRes.data as any)?.ai_ideas_used_month || 0) : 0);
  };

  useEffect(() => { fetchData(); }, [user]);

  const openNew = () => {
    setEditingIdea(null); setFormTitle(""); setFormPillar(""); setFormPlatform("");
    setFormNotes(""); setFormObjective(""); setFormOrigin(""); setAiSuggestion(null); setSheetOpen(true);
  };
  const openEdit = (idea: Idea) => {
    setEditingIdea(idea); setFormTitle(idea.title); setFormPillar(idea.pillar_id || "");
    setFormPlatform(idea.platform || ""); setFormNotes(idea.notes || "");
    setFormObjective(idea.objective || ""); setFormOrigin(idea.origin || "");
    setAiSuggestion(null); setSheetOpen(true);
  };

  const handleSuggestTag = async () => {
    if (!formTitle.trim() || pillars.length === 0 || formPillar) return;
    try {
      const suggestedPillarName = await suggestTag(formTitle, pillars, user?.id);
      if (suggestedPillarName) {
        const found = pillars.find(p => p.name.toLowerCase() === String(suggestedPillarName).toLowerCase().trim());
        if (found) setAiSuggestion(found.id);
      }
    } catch (error) { console.error("AI suggestion failed", error); }
  };

  const handleAiSuggest = async (targetIdea: Idea) => {
    if (!user || !targetIdea || aiLoading) return;

    const { data: profileData } = await supabase
      .from("profiles").select("ai_ideas_used_month, ai_ideas_reset_at").eq("id", user.id).single();

    const today = new Date().toISOString().split("T")[0];
    const resetAt = (profileData as any)?.ai_ideas_reset_at || today;
    const resetMonth = String(resetAt).substring(0, 7);
    const currentMonth = today.substring(0, 7);

    let usedThisMonth = (profileData as any)?.ai_ideas_used_month || 0;

    if (resetMonth !== currentMonth) {
      usedThisMonth = 0;
      await supabase.from("profiles").update({ ai_ideas_used_month: 0, ai_ideas_reset_at: today } as any).eq("id", user.id);
    }

    if (usedThisMonth >= AI_LIMIT) {
      toast.error(`Limite de ${AI_LIMIT} sugestões/mês atingido.`);
      return;
    }

    setAiLoading(true);
    setTargetIdeaId(targetIdea.id);
    try {
      const result = await supabase.functions.invoke("ai-context-builder", {
        body: {
          userId: user.id,
          operation: "idea-suggestions",
          data: {
            ideiaTexto: targetIdea.title,
            platform: targetIdea.platform || "instagram",
            pilar: pillars.find(p => p.id === targetIdea.pillar_id)?.name || "",
            objetivo: targetIdea.objective || "",
            niche: "lifestyle",
          },
        },
      });

      if (result.error) throw result.error;

      const text = result.data?.result || "[]";
      const jsonMatch = String(text).match(/\[.*\]/s);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      setAiSuggestions(Array.isArray(parsed) ? parsed : []);
      setShowAiPanel(true);

      const newUsed = usedThisMonth + 1;
      await supabase.from("profiles").update({
        ai_ideas_used_month: newUsed,
        ai_ideas_reset_at: today,
      } as any).eq("id", user.id);
      setAiUsed(newUsed);
    } catch (e) {
      toast.error("Erro ao gerar sugestões. Tente novamente.");
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !user) return;
    const data: any = {
      title: formTitle.trim(), pillar_id: formPillar || null,
      platform: formPlatform || null, notes: formNotes || null,
      objective: formObjective || null, origin: formOrigin || null,
      user_id: user.id,
    };
    if (editingIdea) {
      const { error } = await supabase.from("ideas").update(data).eq("id", editingIdea.id);
      if (error) { toast.error("Erro ao atualizar."); return; }
      toast.success("Ideia atualizada!");
    } else {
      const { error } = await supabase.from("ideas").insert(data);
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
  const getPillar = (id: string | null) => pillars.find(p => p.id === id);

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

        {/* AI Suggestions Panel */}
        {showAiPanel && aiSuggestions.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Variações de post
              </p>
              <button onClick={() => { setShowAiPanel(false); setTargetIdeaId(null); }}>
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            {targetIdeaId && (
              <p className="text-[10px] text-muted-foreground font-body mb-3">
                Para: <span className="font-medium">{ideas.find(i => i.id === targetIdeaId)?.title}</span>
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              {aiSuggestions.map((s, i) => (
                <div key={i} className="bg-background border border-border rounded-xl p-3 hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-body bg-primary/10 text-primary px-1.5 py-0.5 rounded capitalize">{s.formato}</span>
                    <span className="text-[10px] font-body text-muted-foreground capitalize">{s.objetivo}</span>
                  </div>
                  <p className="text-sm font-body font-medium text-foreground mb-1.5 leading-snug">{s.titulo}</p>
                  {s.angulo && (
                    <p className="text-[10px] font-body text-muted-foreground mb-2">📐 {s.angulo}</p>
                  )}
                  <button
                    onClick={() => {
                      const origem = ideas.find(id => id.id === targetIdeaId);
                      setFormTitle(s.titulo);
                      setFormPlatform(origem?.platform || "instagram");
                      setFormPillar(origem?.pillar_id || "");
                      setSheetOpen(true);
                      setShowAiPanel(false);
                    }}
                    className="mt-2 text-xs font-body text-primary hover:underline"
                  >
                    Usar essa ideia →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar ideias..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterPillar(null)} className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${!filterPillar ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Todos</button>
            {pillars.map(p => (
              <button key={p.id} onClick={() => setFilterPillar(p.id)} className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${filterPillar === p.id ? "text-primary-foreground border-transparent" : "bg-card border-border"}`} style={filterPillar === p.id ? { backgroundColor: p.color } : {}}>{p.name}</button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors flex items-center gap-1 ${filterObjective ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                {filterObjective ? OBJECTIVES.find(o => o.key === filterObjective)?.label : "Objetivo"} <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterObjective(null)}>Todos</DropdownMenuItem>
              {OBJECTIVES.map(o => <DropdownMenuItem key={o.key} onClick={() => setFilterObjective(o.key)}>{o.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors flex items-center gap-1 ${filterStatus ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                {filterStatus ? IDEA_STATUSES.find(s => s.key === filterStatus)?.label : "Status"} <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterStatus(null)}>Todos</DropdownMenuItem>
              {IDEA_STATUSES.map(s => <DropdownMenuItem key={s.key} onClick={() => setFilterStatus(s.key)}>{s.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 shadow-[var(--shadow-warm)] border border-border text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5"><Lightbulb className="h-8 w-8 text-primary" /></div>
            <p className="text-lg font-display font-semibold text-foreground mb-2">{ideas.length === 0 ? "Sua primeira ideia está te esperando" : "Nenhuma ideia encontrada"}</p>
            <p className="text-muted-foreground font-body max-w-sm mx-auto mb-6">{ideas.length === 0 ? "Anota aquela ideia que veio no banho, no ônibus, ou no meio da madrugada." : "Tente mudar os filtros."}</p>
            {ideas.length === 0 && <Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Anotar minha primeira ideia</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((idea, i) => {
              const pillar = getPillar(idea.pillar_id);
              const isPromoted = !!idea.promoted_to_post_id;
              const statusBadge = getStatusBadge(idea.idea_status);
              return (
                <motion.div key={idea.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={`bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border group ${isPromoted ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-body font-semibold text-foreground leading-snug flex-1">{idea.title}</h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(idea)} className="p-1 hover:bg-accent rounded-lg"><Edit2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      <button onClick={() => handleDelete(idea.id)} className="p-1 hover:bg-destructive/10 rounded-lg"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  </div>
                  {idea.notes && <p className="text-sm text-muted-foreground font-body mb-3 line-clamp-2">{idea.notes}</p>}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {pillar && <span className="px-2 py-0.5 rounded-lg text-xs font-body font-medium text-primary-foreground" style={{ backgroundColor: pillar.color }}>{pillar.name}</span>}
                    {idea.objective && <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-muted text-muted-foreground">{getObjectiveLabel(idea.objective)}</span>}
                    {idea.platform && <PlatformIcon platform={idea.platform as any} size="sm" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-body font-semibold ${statusBadge.color}`}>{statusBadge.label}</span>
                  </div>
                  {!isPromoted ? (
                    <button onClick={() => handlePromoteToPost(idea)} className="mt-3 text-sm text-primary font-body font-medium flex items-center gap-1 hover:underline">Transformar em post <ArrowRight className="h-3.5 w-3.5" /></button>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground font-body italic">Já virou post</p>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAiSuggest(idea); }}
                      disabled={aiLoading || aiUsed >= AI_LIMIT}
                      className="flex items-center gap-1 text-[10px] font-body text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                      title={`Gerar variações de post (${AI_LIMIT - aiUsed}/${AI_LIMIT} restantes este mês)`}
                    >
                      <Sparkles className="h-3 w-3" />
                      Gerar variações
                    </button>
                    <span className="text-[9px] text-muted-foreground/40 font-body">
                      {AI_LIMIT - aiUsed}/{AI_LIMIT}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      <Button variant="hero" size="icon" className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-2xl md:hidden z-40" onClick={openNew}><Plus className="h-6 w-6" /></Button>

      {/* Dialog de criação/edição */}
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="bg-background max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editingIdea ? "Editar Ideia" : "Nova Ideia"}</DialogTitle></DialogHeader>
          <div className="space-y-5 mt-2">
            <div className="space-y-2">
              <Label className="font-body">Título</Label>
              <Input placeholder="Qual é a ideia?" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} onBlur={handleSuggestTag} className="rounded-xl" />
              {aiSuggestion && (
                <div className="flex items-center gap-2 bg-primary/5 p-2 rounded-xl border border-primary/10">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-body text-muted-foreground">Sugestão: <span className="font-semibold text-foreground">{getPillar(aiSuggestion)?.name}</span></span>
                  <button onClick={() => { setFormPillar(aiSuggestion); setAiSuggestion(null); }} className="ml-auto text-xs font-semibold text-primary hover:underline">Aceitar</button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-body">Pilar</Label>
              <div className="flex flex-wrap gap-2">
                {pillars.map(p => (
                  <button key={p.id} onClick={() => { setFormPillar(formPillar === p.id ? "" : p.id); setAiSuggestion(null); }} className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${formPillar === p.id ? "text-primary-foreground border-transparent" : "bg-card border-border"}`} style={formPillar === p.id ? { backgroundColor: p.color } : {}}>{p.name}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Plataforma</Label>
              <div className="flex gap-2">
                {PLATFORMS.map((platform) => (
                  <button key={platform} onClick={() => setFormPlatform(formPlatform === platform ? "" : platform)} className={`px-4 py-3 rounded-xl border transition-colors ${formPlatform === platform ? "bg-primary/10 border-primary" : "bg-card border-border"}`}><PlatformIcon platform={platform} size="md" /></button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Notas</Label>
              <Textarea placeholder="Detalhes, referências, links..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="rounded-xl min-h-[100px]" />
            </div>
            <div className="space-y-2">
              <Label className="font-body">Objetivo do conteúdo</Label>
              <div className="flex flex-wrap gap-2">
                {OBJECTIVES.map(o => (
                  <button key={o.key} onClick={() => setFormObjective(formObjective === o.key ? "" : o.key)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${formObjective === o.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Origem da ideia</Label>
              <div className="flex flex-wrap gap-2">
                {ORIGINS.map(o => (
                  <button key={o.key} onClick={() => setFormOrigin(formOrigin === o.key ? "" : o.key)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${formOrigin === o.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="hero" className="w-full" onClick={handleSave} disabled={!formTitle.trim()}>{editingIdea ? "Salvar alterações" : "Capturar ideia"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <PostDrawer open={postDrawerOpen} onOpenChange={setPostDrawerOpen} post={promotedPost} pillars={pillars} userId={user?.id || ""} onSaved={fetchData} />
    </div>
  );
};

export default Ideias;

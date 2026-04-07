import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Lightbulb, Search, ArrowRight, Trash2, Edit2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { suggestTag } from "@/lib/ai/claude";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Idea {
  id: string;
  title: string;
  pillar_id: string | null;
  platform: string | null;
  notes: string | null;
  created_at: string;
}

interface Pillar {
  id: string;
  name: string;
  color: string;
}

const PLATFORMS = ["instagram", "tiktok", "youtube"] as const;

const Ideias = () => {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [search, setSearch] = useState("");
  const [filterPillar, setFilterPillar] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formPillar, setFormPillar] = useState("");
  const [formPlatform, setFormPlatform] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const [ideasRes, pillarsRes] = await Promise.all([
      supabase.from("ideas").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("pillars").select("*").eq("user_id", user.id).order("position"),
    ]);
    setIdeas(ideasRes.data || []);
    setPillars(pillarsRes.data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const openNew = () => {
    setEditingIdea(null);
    setFormTitle("");
    setFormPillar("");
    setFormPlatform("");
    setFormNotes("");
    setAiSuggestion(null);
    setSheetOpen(true);
  };

  const openEdit = (idea: Idea) => {
    setEditingIdea(idea);
    setFormTitle(idea.title);
    setFormPillar(idea.pillar_id || "");
    setFormPlatform(idea.platform || "");
    setFormNotes(idea.notes || "");
    setAiSuggestion(null);
    setSheetOpen(true);
  };

  const handleSuggestTag = async () => {
    if (!formTitle.trim() || pillars.length === 0 || formPillar) return;
    setIsSuggesting(true);
    try {
      const suggestedPillarName = await suggestTag(formTitle, pillars);
      if (suggestedPillarName) {
        const found = pillars.find(p => p.name.toLowerCase() === suggestedPillarName.toLowerCase());
        if (found) {
          setAiSuggestion(found.id);
        }
      }
    } catch (error) {
      console.error("AI suggestion failed", error);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !user) return;
    const data = {
      title: formTitle.trim(),
      pillar_id: formPillar || null,
      platform: formPlatform || null,
      notes: formNotes || null,
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
    setSheetOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ideas").delete().eq("id", id);
    if (!error) { toast.success("Ideia removida."); fetchData(); }
  };

  const filtered = ideas.filter(idea => {
    const matchSearch = !search || idea.title.toLowerCase().includes(search.toLowerCase());
    const matchPillar = !filterPillar || idea.pillar_id === filterPillar;
    return matchSearch && matchPillar;
  });

  const getPillar = (id: string | null) => pillars.find(p => p.id === id);

  return (
    <div className="max-w-4xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Minhas Ideias</h1>
            <p className="text-muted-foreground font-body mt-1">Seu banco de inspirações.</p>
          </div>
          <Button variant="hero" onClick={openNew} className="hidden md:flex">
            <Plus className="h-4 w-4 mr-1" /> Nova Ideia
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ideias..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterPillar(null)}
              className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${
                !filterPillar ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
              }`}
            >
              Todos
            </button>
            {pillars.map(p => (
              <button
                key={p.id}
                onClick={() => setFilterPillar(p.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${
                  filterPillar === p.id ? "text-primary-foreground border-transparent" : "bg-card border-border"
                }`}
                style={filterPillar === p.id ? { backgroundColor: p.color } : {}}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Ideas grid */}
        {filtered.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 shadow-warm border border-border text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Lightbulb className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-display font-semibold text-foreground mb-2">
              {ideas.length === 0 ? "Sua primeira ideia está te esperando" : "Nenhuma ideia encontrada"}
            </p>
            <p className="text-muted-foreground font-body max-w-sm mx-auto mb-6">
              {ideas.length === 0
                ? "Anota aquela ideia que veio no banho, no ônibus, ou no meio da madrugada. Aqui é o lugar seguro pra ela."
                : "Tente mudar os filtros ou buscar por outro termo."
              }
            </p>
            {ideas.length === 0 && (
              <Button variant="hero" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" /> Anotar minha primeira ideia
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((idea, i) => {
              const pillar = getPillar(idea.pillar_id);
              return (
                <motion.div
                  key={idea.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card rounded-2xl p-5 shadow-warm border border-border group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-body font-semibold text-foreground leading-snug flex-1">{idea.title}</h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(idea)} className="p-1 hover:bg-accent rounded-lg">
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDelete(idea.id)} className="p-1 hover:bg-destructive/10 rounded-lg">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                  {idea.notes && (
                    <p className="text-sm text-muted-foreground font-body mb-3 line-clamp-2">{idea.notes}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {pillar && (
                      <span
                        className="px-2 py-0.5 rounded-lg text-xs font-body font-medium text-primary-foreground"
                        style={{ backgroundColor: pillar.color }}
                      >
                        {pillar.name}
                      </span>
                    )}
                    {idea.platform && (
                      <PlatformIcon platform={idea.platform as any} size="sm" />
                    )}
                  </div>
                  <button className="mt-3 text-sm text-primary font-body font-medium flex items-center gap-1 hover:underline">
                    Transformar em post <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* FAB Mobile */}
      <Button 
        variant="hero" 
        size="icon" 
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-2xl md:hidden z-40"
        onClick={openNew}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Sheet for create/edit */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="bg-background">
          <SheetHeader>
            <SheetTitle className="font-display">
              {editingIdea ? "Editar Ideia" : "Nova Ideia"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="space-y-2">
              <Label className="font-body">Título</Label>
              <Input
                placeholder="Qual é a ideia?"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                onBlur={handleSuggestTag}
                className="rounded-xl"
              />
              {aiSuggestion && (
                <div className="flex items-center gap-2 bg-primary/5 p-2 rounded-xl animate-fade-in border border-primary/10">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-body text-muted-foreground">
                    Sugestão: <span className="font-semibold text-foreground">{getPillar(aiSuggestion)?.name}</span>
                  </span>
                  <button 
                    onClick={() => { setFormPillar(aiSuggestion); setAiSuggestion(null); }}
                    className="ml-auto text-xs font-semibold text-primary hover:underline"
                  >
                    Aceitar
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-body">Pilar</Label>
              <div className="flex flex-wrap gap-2">
                {pillars.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setFormPillar(formPillar === p.id ? "" : p.id); setAiSuggestion(null); }}
                    className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${
                      formPillar === p.id ? "text-primary-foreground border-transparent" : "bg-card border-border"
                    }`}
                    style={formPillar === p.id ? { backgroundColor: p.color } : {}}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Plataforma</Label>
              <div className="flex gap-2">
                {PLATFORMS.map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setFormPlatform(formPlatform === platform ? "" : platform)}
                    className={`px-4 py-3 rounded-xl border transition-colors ${
                      formPlatform === platform ? "bg-primary/10 border-primary" : "bg-card border-border"
                    }`}
                  >
                    <PlatformIcon platform={platform} size="md" />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Notas</Label>
              <Textarea
                placeholder="Detalhes, referências, links..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="rounded-xl min-h-[100px]"
              />
            </div>
            <Button variant="hero" className="w-full" onClick={handleSave} disabled={!formTitle.trim()}>
              {editingIdea ? "Salvar alterações" : "Capturar ideia"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Ideias;

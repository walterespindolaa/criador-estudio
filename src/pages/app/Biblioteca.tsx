import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, MessageSquareText, FileCode2, Palette, Plus, Trash2, Upload, Paintbrush, Languages, MessageSquare, Ban } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/CopyButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface BrandItem {
  id: string;
  type: string;
  name: string;
  value: string | null;
}

const BRAND_SECTIONS = [
  { type: "cor", label: "🎨 Cores da marca", placeholder: "Ex: #C4622D" },
  { type: "fonte", label: "✏️ Fontes", placeholder: "Ex: Playfair Display" },
  { type: "tom", label: "🗣️ Tom de voz", placeholder: "Ex: Acolhedor e direto" },
  { type: "expressao", label: "💬 Expressões que uso", placeholder: "Ex: Bora!" },
  { type: "evitar", label: "🚫 Palavras que evito", placeholder: "Ex: Não use gírias" },
];

const HOOK_CATEGORIES = ["curiosidade", "identificação", "contraste", "dor", "promessa", "polêmica"];

const FALLBACK_HOOKS = [
  { text: "Você sabia que [dado surpreendente]?", category: "curiosidade", platforms: ["instagram", "tiktok"] },
  { text: "O erro que [público] comete sem perceber...", category: "dor", platforms: ["instagram", "youtube"] },
  { text: "3 coisas que eu faria diferente se começasse hoje", category: "identificação", platforms: ["instagram", "tiktok", "youtube"] },
  { text: "A verdade que ninguém fala sobre [tema]", category: "polêmica", platforms: ["instagram", "tiktok"] },
  { text: "Pare de [ação comum] se quiser [resultado]", category: "contraste", platforms: ["instagram", "tiktok"] },
  { text: "Eu gastei [tempo] pra aprender isso — te conto em 60s", category: "curiosidade", platforms: ["tiktok", "youtube"] },
  { text: "Se você [dor do público], esse vídeo é pra você", category: "identificação", platforms: ["youtube", "tiktok"] },
  { text: "O segredo que [referência] não te conta", category: "promessa", platforms: ["instagram", "youtube"] },
  { text: "Não faça isso se quiser [resultado]!", category: "contraste", platforms: ["tiktok", "instagram"] },
  { text: "Por que [coisa popular] na verdade não funciona", category: "polêmica", platforms: ["youtube", "instagram"] },
];

const FALLBACK_PROMPTS = [
  { title: "Gerar ideias de conteúdo", text: "Me dê 10 ideias de conteúdo para [NICHO] focando em [PILAR]. O público é [PÚBLICO-ALVO].", category: "ideia", tip: "Substitua os [COLCHETES] pelo seu nicho e pilar" },
  { title: "Escrever legenda", text: "Escreva uma legenda para Instagram sobre [TEMA]. Tom: [TOM]. Inclua CTA e 5 hashtags relevantes.", category: "legenda", tip: "Defina bem o tom da sua marca" },
  { title: "Roteiro de Reels 30s", text: "Crie um roteiro de Reels de 30-60 segundos sobre [TEMA]. Comece com um hook forte. Formato: Hook → Conteúdo → CTA.", category: "roteiro", tip: "Reels curtos performam melhor" },
  { title: "Brainstorm de hooks", text: "Me dê 5 hooks diferentes para um post sobre [TEMA]. Estilo: [curiosidade/polêmica/identificação/contraste].", category: "ideia", tip: "Teste hooks diferentes no mesmo conteúdo" },
  { title: "Planejar carrossel", text: "Monte um carrossel de 8 slides sobre [TEMA]. Slide 1 = hook visual. Slide 2-7 = conteúdo. Slide 8 = CTA + salvar.", category: "roteiro", tip: "Carrossel tem alto alcance orgânico" },
  { title: "Bio para Instagram", text: "Crie uma bio de Instagram para [NICHO]. Inclua: O que faço, pra quem, CTA. Máximo 150 caracteres.", category: "marca", tip: "Bio clara converte melhor" },
];

const PROMPT_CATEGORIES = ["legenda", "roteiro", "ideia", "marca"];

const Biblioteca = () => {
  const { user } = useAuth();
  const [brandItems, setBrandItems] = useState<BrandItem[]>([]);
  const [hookFilter, setHookFilter] = useState<string | null>(null);
  const [promptFilter, setPromptFilter] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemValue, setNewItemValue] = useState("");
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("brand_items").select("*").eq("user_id", user.id).order("position")
      .then(({ data }) => setBrandItems(data || []));
  }, [user]);

  const addBrandItem = async (type: string) => {
    if (!newItemName.trim() || !user) return;
    await supabase.from("brand_items").insert({
      user_id: user.id,
      type,
      name: newItemName.trim(),
      value: newItemValue || null,
      position: brandItems.filter(i => i.type === type).length,
    });
    setNewItemName(""); setNewItemValue("");
    const { data } = await supabase.from("brand_items").select("*").eq("user_id", user.id).order("position");
    setBrandItems(data || []);
    toast.success("Item adicionado!");
  };

  const deleteBrandItem = async (id: string) => {
    await supabase.from("brand_items").delete().eq("id", id);
    setBrandItems(prev => prev.filter(i => i.id !== id));
  };

  const filteredHooks = hookFilter
    ? FALLBACK_HOOKS.filter(h => h.category === hookFilter)
    : FALLBACK_HOOKS;

  const filteredPrompts = promptFilter
    ? FALLBACK_PROMPTS.filter(p => p.category === promptFilter)
    : FALLBACK_PROMPTS;

  return (
    <div className="max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Biblioteca</h1>
        <p className="text-muted-foreground font-body mb-8">Referências e identidade da sua marca.</p>

        <Tabs defaultValue="hooks">
          <TabsList className="bg-card border border-border rounded-xl mb-6">
            <TabsTrigger value="hooks" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Sparkles className="h-4 w-4 mr-1" /> Hooks
            </TabsTrigger>
            <TabsTrigger value="formatos" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <FileCode2 className="h-4 w-4 mr-1" /> Formatos
            </TabsTrigger>
            <TabsTrigger value="prompts" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <MessageSquareText className="h-4 w-4 mr-1" /> Prompts
            </TabsTrigger>
            <TabsTrigger value="marca" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Palette className="h-4 w-4 mr-1" /> Minha Marca
            </TabsTrigger>
          </TabsList>

          {/* HOOKS */}
          <TabsContent value="hooks">
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setHookFilter(null)}
                className={`px-3 py-1 rounded-xl text-xs font-body border transition-colors ${
                  !hookFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                }`}
              >
                Todos
              </button>
              {HOOK_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setHookFilter(hookFilter === cat ? null : cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-body border capitalize transition-colors ${
                    hookFilter === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredHooks.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card rounded-xl p-4 shadow-warm border border-border"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-primary/10 text-primary capitalize">
                      {h.category}
                    </span>
                    <CopyButton text={h.text} />
                  </div>
                  <p className="text-sm font-body text-foreground">"{h.text}"</p>
                  <div className="flex gap-1 mt-2">
                    {h.platforms.map(p => (
                      <span key={p} className="text-xs">
                        {p === "instagram" ? "📸" : p === "tiktok" ? "🎵" : "🎬"}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* FORMATOS */}
          <TabsContent value="formatos">
            <div className="bg-card rounded-2xl p-12 shadow-warm border border-border text-center">
              <FileCode2 className="h-8 w-8 text-primary mx-auto mb-3" />
              <p className="text-muted-foreground font-body">
                Formatos de conteúdo em breve! Estamos preparando estruturas prontas pra cada tipo de post.
              </p>
            </div>
          </TabsContent>

          {/* PROMPTS */}
          <TabsContent value="prompts">
            <p className="text-sm text-muted-foreground font-body mb-4">
              Copie, preencha os <span className="text-primary font-medium">[COLCHETES]</span> e cole no ChatGPT ou Claude
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setPromptFilter(null)}
                className={`px-3 py-1 rounded-xl text-xs font-body border transition-colors ${
                  !promptFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                }`}
              >
                Todos
              </button>
              {PROMPT_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setPromptFilter(promptFilter === cat ? null : cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-body border capitalize transition-colors ${
                    promptFilter === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {filteredPrompts.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card rounded-xl p-5 shadow-warm border border-border"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-secondary/10 text-secondary capitalize mr-2">
                        {p.category}
                      </span>
                      <span className="font-body font-semibold text-sm text-foreground">{p.title}</span>
                    </div>
                    <CopyButton text={p.text} />
                  </div>
                  <p className="text-sm text-foreground font-body leading-relaxed mb-2">
                    {p.text.split(/(\[[^\]]+\])/).map((part, j) =>
                      part.startsWith("[") ? (
                        <span key={j} className="text-primary font-medium">{part}</span>
                      ) : (
                        <span key={j}>{part}</span>
                      )
                    )}
                  </p>
                  {p.tip && (
                    <p className="text-xs text-muted-foreground font-body">💡 {p.tip}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* MINHA MARCA */}
          <TabsContent value="marca">
            <div className="space-y-6">
              {BRAND_SECTIONS.map(section => {
                const items = brandItems.filter(i => i.type === section.type);
                return (
                  <div key={section.type} className="bg-card rounded-2xl p-5 shadow-warm border border-border">
                    <h3 className="font-body font-semibold text-foreground mb-3">{section.label}</h3>
                    {items.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {items.map(item => (
                          <div
                            key={item.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-background rounded-xl border border-border"
                          >
                            {section.type === "cor" && item.value && (
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.value }} />
                            )}
                            <span className="text-sm font-body text-foreground">{item.name}</span>
                            {item.value && section.type !== "cor" && (
                              <span className="text-xs text-muted-foreground font-body">({item.value})</span>
                            )}
                            <button onClick={() => deleteBrandItem(item.id)} className="hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {activeSection === section.type ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nome"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          className="rounded-xl text-sm"
                        />
                        <Input
                          placeholder={section.placeholder}
                          value={newItemValue}
                          onChange={(e) => setNewItemValue(e.target.value)}
                          className="rounded-xl text-sm"
                        />
                        <Button size="sm" onClick={() => addBrandItem(section.type)} disabled={!newItemName.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setActiveSection(section.type); setNewItemName(""); setNewItemValue(""); }}
                        className="text-sm text-primary font-body font-medium hover:underline"
                      >
                        + Adicionar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Biblioteca;

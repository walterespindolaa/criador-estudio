import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, MessageSquareText, FileCode2, Zap, Copy, Check } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/CopyButton";
import { supabase } from "@/integrations/supabase/client";

interface Hook {
  id: string;
  hook_text: string;
  category: string;
  platforms: string[] | null;
}

interface Format {
  id: string;
  name: string;
  platform: string;
  format_type: string;
  structure: string;
  tips: string | null;
}

interface Prompt {
  id: string;
  title: string;
  category: string;
  prompt_text: string;
  tip: string | null;
}

const Biblioteca = () => {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [hookFilter, setHookFilter] = useState<string | null>(null);
  const [viralFilter, setViralFilter] = useState<string | null>(null);
  const [promptFilter, setPromptFilter] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("reference_hooks").select("*").eq("is_active", true),
      supabase.from("reference_formats").select("*").eq("is_active", true),
      supabase.from("reference_prompts").select("*").eq("is_active", true).order("position"),
    ]).then(([hooksRes, formatsRes, promptsRes]) => {
      setHooks(hooksRes.data || []);
      setFormats(formatsRes.data || []);
      setPrompts(promptsRes.data || []);
    });
  }, []);

  // Split hooks: non-viral (original categories) vs viral
  const viralCategories = ["curiosidade", "problema", "revelação", "desafio", "como fazer", "storytelling", "motivação", "autoridade", "resultado", "ação"];
  const classicCategories = ["curiosidade", "identificação", "contraste", "dor", "promessa", "polêmica"];
  
  const viralHooks = hooks.filter(h => viralCategories.includes(h.category));
  const viralCats = [...new Set(viralHooks.map(h => h.category))];
  const filteredViral = viralFilter ? viralHooks.filter(h => h.category === viralFilter) : viralHooks;

  // Prompts
  const promptCats = [...new Set(prompts.map(p => p.category))];
  const filteredPrompts = promptFilter ? prompts.filter(p => p.category === promptFilter) : prompts;

  // Formats
  const formatPlatforms = [...new Set(formats.map(f => f.platform))];
  const filteredFormats = formatFilter ? formats.filter(f => f.platform === formatFilter) : formats;

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

          {/* HOOKS - classic/curated */}
          <TabsContent value="hooks">
            <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto">
              <button onClick={() => setHookFilter(null)} className={`px-3 py-1 rounded-xl text-xs font-body border transition-colors whitespace-nowrap ${!hookFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Todos</button>
              {classicCategories.map(cat => (
                <button key={cat} onClick={() => setHookFilter(hookFilter === cat ? null : cat)} className={`px-3 py-1 rounded-xl text-xs font-body border capitalize transition-colors whitespace-nowrap ${hookFilter === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {hooks.filter(h => classicCategories.includes(h.category)).filter(h => !hookFilter || h.category === hookFilter).map((h, i) => (
                <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-card rounded-xl p-4 shadow-[var(--shadow-warm)] border border-border">
                  <div className="flex items-start justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-primary/10 text-primary capitalize">{h.category}</span>
                    <CopyButton text={h.hook_text} />
                  </div>
                  <p className="text-sm font-body text-foreground">"{h.hook_text}"</p>
                  {h.platforms && (
                    <div className="flex gap-2 mt-2">
                      {h.platforms.map(p => <PlatformIcon key={p} platform={p as any} size="sm" />)}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* FORMATOS */}
          <TabsContent value="formatos">
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
              {filteredFormats.map((f, i) => (
                <motion.div key={f.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="bg-card rounded-xl p-5 shadow-[var(--shadow-warm)] border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <PlatformIcon platform={f.platform as any} size="sm" />
                    <span className="font-body font-semibold text-sm text-foreground">{f.name}</span>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-body bg-muted text-muted-foreground">{f.format_type}</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 mb-2">
                    <p className="text-sm font-body text-foreground font-mono">{f.structure}</p>
                  </div>
                  {f.tips && (
                    <p className="text-xs text-muted-foreground font-body flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> {f.tips}</p>
                  )}
                </motion.div>
              ))}
              {filteredFormats.length === 0 && (
                <div className="bg-card rounded-2xl p-12 shadow-[var(--shadow-warm)] border border-border text-center">
                  <FileCode2 className="h-8 w-8 text-primary mx-auto mb-3" />
                  <p className="text-muted-foreground font-body">Nenhum formato encontrado.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* PROMPTS */}
          <TabsContent value="prompts">
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
              {filteredPrompts.map((p, i) => (
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
                      part.startsWith("[") ? (
                        <span key={j} className="text-primary font-medium">{part}</span>
                      ) : (
                        <span key={j}>{part}</span>
                      )
                    )}
                  </p>
                  {p.tip && (
                    <p className="text-xs text-muted-foreground font-body flex items-center gap-1"><Sparkles className="h-3 w-3" /> {p.tip}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* IDEIAS VIRAIS */}
          <TabsContent value="viral">
            <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto">
              <button onClick={() => setViralFilter(null)} className={`px-3 py-1 rounded-xl text-xs font-body border transition-colors whitespace-nowrap ${!viralFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>Todos</button>
              {viralCats.map(cat => (
                <button key={cat} onClick={() => setViralFilter(viralFilter === cat ? null : cat)} className={`px-3 py-1 rounded-xl text-xs font-body border capitalize transition-colors whitespace-nowrap ${viralFilter === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredViral.map((h, i) => (
                <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-[hsl(var(--card))] rounded-xl p-4 shadow-[var(--shadow-warm)] border border-border bg-gradient-to-br from-amber-50/30 to-transparent dark:from-amber-900/10">
                  <div className="flex items-start justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-lg text-xs font-body bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 capitalize">{h.category}</span>
                    <CopyButton text={h.hook_text} />
                  </div>
                  <p className="text-sm font-body text-foreground">"{h.hook_text}"</p>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Biblioteca;

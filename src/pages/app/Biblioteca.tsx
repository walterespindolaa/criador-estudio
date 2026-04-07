import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, MessageSquareText, FileCode2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

interface Hook {
  id: string;
  category: string;
  hook_text: string;
  example: string | null;
}

interface Prompt {
  id: string;
  category: string;
  title: string;
  prompt_text: string;
  tip: string | null;
}

interface Format {
  id: string;
  name: string;
  platform: string;
  format_type: string;
  structure: string;
  tips: string | null;
}

// Fallback data if DB is empty
const FALLBACK_HOOKS = [
  "Você sabia que [dado surpreendente]?",
  "O erro que [público] comete sem perceber...",
  "3 coisas que eu faria diferente se começasse hoje",
  "A verdade que ninguém fala sobre [tema]",
  "Pare de [ação comum] se quiser [resultado]",
  "Eu gastei [tempo/dinheiro] pra aprender isso — te conto em 60 segundos",
  "Se você [dor do público], esse vídeo é pra você",
  "O segredo que [referência] não te conta",
];

const FALLBACK_PROMPTS = [
  { title: "Gerar ideias de conteúdo", text: "Me dê 10 ideias de conteúdo para [NICHO] focando em [PILAR]. O público é [PÚBLICO-ALVO]." },
  { title: "Escrever legenda", text: "Escreva uma legenda para Instagram sobre [TEMA]. Tom: [TOM]. Inclua CTA e 5 hashtags relevantes." },
  { title: "Criar roteiro de Reels", text: "Crie um roteiro de Reels de 30-60 segundos sobre [TEMA]. Comece com um hook forte." },
  { title: "Brainstorm de hooks", text: "Me dê 5 hooks diferentes para um post sobre [TEMA]. Estilo: [curiosidade/polêmica/identificação]." },
  { title: "Planejar carrossel", text: "Monte um carrossel de 8 slides sobre [TEMA]. Slide 1 = hook. Último slide = CTA." },
];

const Biblioteca = () => {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [hooksRes, promptsRes, formatsRes] = await Promise.all([
        supabase.from("reference_hooks").select("*").eq("is_active", true),
        supabase.from("reference_prompts").select("*").eq("is_active", true).order("position"),
        supabase.from("reference_formats").select("*").eq("is_active", true),
      ]);
      setHooks(hooksRes.data || []);
      setPrompts(promptsRes.data || []);
      setFormats(formatsRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const displayHooks = hooks.length > 0 ? hooks.map(h => h.hook_text) : FALLBACK_HOOKS;
  const displayPrompts = prompts.length > 0
    ? prompts.map(p => ({ title: p.title, text: p.prompt_text }))
    : FALLBACK_PROMPTS;

  return (
    <div className="max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Biblioteca</h1>
        <p className="text-muted-foreground font-body mb-8">Referências prontas para destravar sua criatividade.</p>

        <Tabs defaultValue="hooks">
          <TabsList className="bg-card border border-border rounded-xl mb-6">
            <TabsTrigger value="hooks" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Sparkles className="h-4 w-4 mr-1" /> Hooks
            </TabsTrigger>
            <TabsTrigger value="prompts" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <MessageSquareText className="h-4 w-4 mr-1" /> Prompts
            </TabsTrigger>
            <TabsTrigger value="formatos" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <FileCode2 className="h-4 w-4 mr-1" /> Formatos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hooks">
            <div className="space-y-3">
              {displayHooks.map((hook, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card rounded-xl p-5 shadow-warm border border-border font-body text-foreground"
                >
                  "{hook}"
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="prompts">
            <div className="space-y-4">
              {displayPrompts.map((prompt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card rounded-xl p-5 shadow-warm border border-border"
                >
                  <h4 className="font-body font-semibold text-foreground mb-2">{prompt.title}</h4>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed">{prompt.text}</p>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="formatos">
            {formats.length > 0 ? (
              <div className="space-y-4">
                {formats.map((format, i) => (
                  <motion.div
                    key={format.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card rounded-xl p-5 shadow-warm border border-border"
                  >
                    <h4 className="font-body font-semibold text-foreground mb-1">{format.name}</h4>
                    <p className="text-xs text-muted-foreground font-body mb-2">{format.platform} • {format.format_type}</p>
                    <p className="text-sm text-foreground font-body">{format.structure}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-2xl p-12 shadow-warm border border-border text-center">
                <p className="text-muted-foreground font-body">
                  Formatos de conteúdo em breve! Estamos preparando modelos prontos pra você.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Biblioteca;

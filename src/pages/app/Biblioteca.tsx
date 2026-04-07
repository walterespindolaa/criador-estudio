import { motion } from "framer-motion";
import { BookOpen, Sparkles, MessageSquareText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const hooks = [
  "Você sabia que [dado surpreendente]?",
  "O erro que [público] comete sem perceber...",
  "3 coisas que eu faria diferente se começasse hoje",
  "A verdade que ninguém fala sobre [tema]",
  "Pare de [ação comum] se quiser [resultado]",
];

const prompts = [
  "Qual foi a maior lição que você aprendeu esse mês?",
  "Conte um bastidor do seu trabalho que ninguém vê",
  "Qual conselho você daria pra quem está começando?",
  "O que te motivou a criar conteúdo?",
  "Descreva seu dia ideal de trabalho",
];

const Biblioteca = () => {
  return (
    <div className="max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Biblioteca</h1>
        <p className="text-muted-foreground font-body mb-8">
          Referências prontas para destravar sua criatividade.
        </p>

        <Tabs defaultValue="hooks">
          <TabsList className="bg-card border border-border rounded-xl mb-6">
            <TabsTrigger value="hooks" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Sparkles className="h-4 w-4 mr-1" /> Hooks
            </TabsTrigger>
            <TabsTrigger value="prompts" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <MessageSquareText className="h-4 w-4 mr-1" /> Prompts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hooks">
            <div className="space-y-3">
              {hooks.map((hook, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-xl p-5 shadow-warm border border-border font-body text-foreground"
                >
                  "{hook}"
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="prompts">
            <div className="space-y-3">
              {prompts.map((prompt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-xl p-5 shadow-warm border border-border font-body text-foreground"
                >
                  "{prompt}"
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

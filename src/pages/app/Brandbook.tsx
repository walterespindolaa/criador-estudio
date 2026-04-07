import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { BookOpen, Users, Mic, Copy, Check, Save, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CopyButton } from "@/components/shared/CopyButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface EntryMap { [key: string]: string }

const SECTIONS = {
  "linha-editorial": {
    title: "Linha Editorial",
    icon: BookOpen,
    description: "Defina a essência do seu conteúdo.",
    questions: [
      { key: "ideia-central", label: "Qual é a ideia central do seu conteúdo?", placeholder: "Ex: Ajudar mulheres a se reconectarem com sua autoestima através de moda acessível." },
      { key: "temas", label: "Quais temas você aborda?", placeholder: "Ex: Moda consciente, autoestima, estilo pessoal, compras inteligentes..." },
      { key: "transformacao", label: "Que transformação você promove?", placeholder: "Ex: De insegura com o visual → confiante e autêntica no dia a dia." },
      { key: "tipos-conteudo", label: "Que tipos de conteúdo você cria?", placeholder: "Ex: Dicas rápidas, bastidores, tutoriais, storytelling pessoal..." },
      { key: "lema", label: "Qual é o seu lema ou frase-guia?", placeholder: "Ex: 'Vista quem você é, não quem esperam que você seja.'" },
    ],
    chatPrompt: `Você é um estrategista de conteúdo digital. Com base nas respostas abaixo sobre a linha editorial de um criador de conteúdo, gere um guia editorial completo e prático.

Inclua:
1. Resumo da linha editorial (2-3 frases)
2. Pilares temáticos sugeridos (3-5)
3. Tipos de conteúdo recomendados para cada pilar
4. Tom de comunicação ideal
5. Frequência sugerida
6. Dica de diferenciação

RESPOSTAS DO CRIADOR:
`,
  },
  "persona-brand": {
    title: "Persona",
    icon: Users,
    description: "Conheça profundamente quem te acompanha.",
    questions: [
      { key: "quem-e", label: "Quem é a pessoa que te segue?", placeholder: "Ex: Mulher, 25-35 anos, mora em cidade grande, trabalha com CLT mas sonha em empreender." },
      { key: "dores", label: "Quais são as dores dela?", placeholder: "Ex: Sente que não tem estilo próprio, gasta mal com roupas, não se sente bonita no dia a dia." },
      { key: "desejos", label: "O que ela deseja conquistar?", placeholder: "Ex: Se sentir confiante, montar looks sem esforço, ser elogiada pelo estilo." },
      { key: "crencas", label: "Quais crenças ela carrega?", placeholder: "Ex: 'Moda é pra quem tem dinheiro', 'Eu não tenho corpo pra isso', 'Estilo é dom'." },
      { key: "comportamento", label: "Como ela se comporta online?", placeholder: "Ex: Salva muito conteúdo, comenta pouco, assiste stories até o final, compra por impulso." },
    ],
    chatPrompt: `Você é especialista em marketing de conteúdo e criação de personas. Com base nas respostas abaixo, crie uma persona completa e detalhada.

Inclua:
1. Nome fictício e mini bio
2. Demografia (idade, localização, profissão)
3. Dores principais (com exemplos reais)
4. Desejos profundos
5. Crenças limitantes
6. Comportamento digital
7. Gatilhos de compra
8. Tipo de conteúdo que mais engaja essa persona
9. Linguagem que conecta com ela

RESPOSTAS DO CRIADOR:
`,
  },
  "tom-de-voz": {
    title: "Tom de Voz",
    icon: Mic,
    description: "Defina como você se comunica.",
    questions: [
      { key: "estilo", label: "Qual é o seu estilo de comunicação?", placeholder: "Ex: Leve e acolhedora, como uma conversa com amiga. Direto mas sem ser frio." },
      { key: "palavras", label: "Que palavras/expressões você usa muito?", placeholder: "Ex: 'Bora?', 'Olha que incrível', 'Vem comigo', 'Isso é real'..." },
      { key: "evitar", label: "O que você evita na comunicação?", placeholder: "Ex: Gírias muito jovens, tom de vendedor, linguagem técnica demais, negatividade." },
      { key: "referencias", label: "Quais criadores inspiram seu tom?", placeholder: "Ex: Nath Finanças (didática), Boca Rosa (autêntica), Whindersson (humor leve)." },
      { key: "emocao", label: "Que emoção você quer despertar?", placeholder: "Ex: Pertencimento, confiança, leveza, motivação gentil." },
    ],
    chatPrompt: `Você é um copywriter e estrategista de marca pessoal. Com base nas respostas abaixo, crie um guia completo de tom de voz para um criador de conteúdo.

Inclua:
1. Resumo do tom (2-3 frases)
2. Adjetivos que definem a comunicação (5-7)
3. Expressões e vocabulário recomendado
4. O que evitar (linguagem, tom, palavras)
5. Exemplos práticos de legendas no tom certo (3 exemplos)
6. Como adaptar o tom para diferentes formatos (stories, reels, legendas)
7. Referências de inspiração

RESPOSTAS DO CRIADOR:
`,
  },
};

type SectionKey = keyof typeof SECTIONS;

const Brandbook = () => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<SectionKey, EntryMap>>({
    "linha-editorial": {},
    "persona-brand": {},
    "tom-de-voz": {},
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("moodboard_entries")
      .select("section, question_key, answer")
      .eq("user_id", user.id)
      .in("section", ["linha-editorial", "persona-brand", "tom-de-voz"])
      .then(({ data }) => {
        if (!data) { setLoaded(true); return; }
        const grouped: Record<SectionKey, EntryMap> = {
          "linha-editorial": {},
          "persona-brand": {},
          "tom-de-voz": {},
        };
        data.forEach((e) => {
          const s = e.section as SectionKey;
          if (grouped[s]) grouped[s][e.question_key] = e.answer || "";
        });
        setAnswers(grouped);
        setLoaded(true);
      });
  }, [user]);

  const handleChange = (section: SectionKey, key: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  const saveSection = useCallback(async (section: SectionKey) => {
    if (!user) return;
    setSaving(true);
    const entries = SECTIONS[section].questions.map((q) => ({
      user_id: user.id,
      section,
      question_key: q.key,
      answer: answers[section][q.key] || "",
    }));

    for (const entry of entries) {
      await supabase.from("moodboard_entries").upsert(entry, {
        onConflict: "user_id,section,question_key",
      });
    }

    toast.success("Salvo com sucesso!");
    setSaving(false);
  }, [user, answers]);

  const buildPrompt = (section: SectionKey) => {
    const config = SECTIONS[section];
    let prompt = config.chatPrompt;
    config.questions.forEach((q) => {
      const ans = answers[section][q.key] || "(não respondido)";
      prompt += `\n${q.label}\n→ ${ans}\n`;
    });
    return prompt;
  };

  const getSectionProgress = (section: SectionKey) => {
    const qs = SECTIONS[section].questions;
    const filled = qs.filter((q) => (answers[section][q.key] || "").trim().length > 0).length;
    return Math.round((filled / qs.length) * 100);
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Brandbook</h1>
        <p className="text-muted-foreground font-body mb-8">
          Construa a identidade da sua marca pessoal. Responda com calma — essas respostas guiam toda a sua comunicação.
        </p>

        <Tabs defaultValue="linha-editorial">
          <TabsList className="bg-card border border-border rounded-xl mb-6 flex-wrap h-auto gap-1 p-1">
            {(Object.keys(SECTIONS) as SectionKey[]).map((key) => {
              const s = SECTIONS[key];
              const Icon = s.icon;
              const progress = getSectionProgress(key);
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.title}
                  {progress > 0 && progress < 100 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">{progress}%</span>
                  )}
                  {progress === 100 && <Check className="h-3 w-3 text-secondary ml-1" />}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {(Object.keys(SECTIONS) as SectionKey[]).map((sectionKey) => {
            const section = SECTIONS[sectionKey];
            const Icon = section.icon;
            const progress = getSectionProgress(sectionKey);

            return (
              <TabsContent key={sectionKey} value={sectionKey}>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-display font-semibold text-foreground">{section.title}</h2>
                      <p className="text-sm text-muted-foreground font-body">{section.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground font-body">{progress}% completo</span>
                      <Progress value={progress} className="w-24 h-1.5 mt-1" />
                    </div>
                  </div>

                  {/* Questions */}
                  {section.questions.map((q, i) => (
                    <motion.div
                      key={q.key}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="border-border shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-body font-semibold text-foreground">
                            {q.label}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Textarea
                            value={answers[sectionKey][q.key] || ""}
                            onChange={(e) => handleChange(sectionKey, q.key, e.target.value)}
                            placeholder={q.placeholder}
                            className="min-h-[80px] resize-y font-body text-sm border-border rounded-xl"
                          />
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}

                  {/* Save button */}
                  <div className="flex justify-end">
                    <Button onClick={() => saveSection(sectionKey)} disabled={saving} className="gap-2">
                      <Save className="h-4 w-4" />
                      {saving ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>

                  {/* Chat prompt block */}
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Perguntar ao Chat
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground font-body">
                        Copie o prompt abaixo e cole no ChatGPT ou Claude para gerar um guia completo de{" "}
                        {section.title.toLowerCase()}.
                      </p>
                      <div className="bg-card rounded-xl p-4 border border-border max-h-48 overflow-y-auto">
                        <pre className="text-xs font-body text-foreground whitespace-pre-wrap">
                          {buildPrompt(sectionKey)}
                        </pre>
                      </div>
                      <CopyButton text={buildPrompt(sectionKey)} />
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            );
          })}
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Brandbook;

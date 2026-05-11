import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Users, Mic, Save, Sparkles, Eye, Palette, Heart, Paintbrush, Languages, MessageSquareText, MessageSquare, Ban, Plus, Trash2, BookMarked } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CopyButton } from "@/components/shared/CopyButton";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { toast } from "sonner";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { useBrandItems } from "@/hooks/useBrandItems";
import { useMoodboard } from "@/hooks/useMoodboard";
import { usePersonas } from "@/hooks/usePersonas";

interface EntryMap { [key: string]: string }
interface PersonaData {
  id: string | null;
  name: string;
  age_range: string;
  gender: string;
  location: string;
  interests: string[];
  pain_points: string[];
  desires: string[];
  platforms: string[];
  notes: string;
}

// ─── Section definitions for guided questions ────────────
const QUESTION_SECTIONS = {
  "moodboard-identidade": {
    title: "Identidade e Sensações",
    questions: [
      { key: "sensacoes", label: "Que sensação sua marca transmite?", placeholder: "Ex: Acolhimento, leveza, sofisticação acessível..." },
      { key: "palavras-chave", label: "Palavras-chave que definem sua essência?", placeholder: "Ex: Autenticidade, liberdade, conexão..." },
      { key: "se-fosse", label: "Se sua marca fosse uma pessoa, como seria?", placeholder: "Ex: Uma amiga próxima que entende de moda e te acolhe..." },
    ],
  },
  "moodboard-visual": {
    title: "Visual e Estilo",
    questions: [
      { key: "cores", label: "Que cores representam sua marca?", placeholder: "Ex: Tons terrosos, nude, laranja queimado..." },
      { key: "estetica", label: "Qual é a estética visual?", placeholder: "Ex: Clean, minimalista com toques orgânicos..." },
      { key: "referencias-visuais", label: "Referências visuais que te inspiram?", placeholder: "Ex: Pinterest boards, marcas, artistas..." },
    ],
  },
  "moodboard-contexto": {
    title: "Contexto e Propósito",
    questions: [
      { key: "por-que", label: "Por que você cria conteúdo?", placeholder: "Ex: Para ajudar mulheres a se sentirem bonitas..." },
      { key: "diferencial", label: "O que te diferencia de outros criadores?", placeholder: "Ex: Minha abordagem é real e acessível..." },
      { key: "legado", label: "Que impacto você quer causar?", placeholder: "Ex: Que as pessoas se aceitem como são..." },
    ],
  },
  "moodboard-inspiracoes": {
    title: "Inspirações Pessoais",
    questions: [
      { key: "criadores", label: "Criadores que te inspiram?", placeholder: "Ex: Nath Finanças, Boca Rosa, Whindersson..." },
      { key: "marcas", label: "Marcas que admira?", placeholder: "Ex: Pantys, Farm, Glossier..." },
      { key: "conteudos", label: "Conteúdos que te marcaram?", placeholder: "Ex: Um vídeo, uma frase, um podcast..." },
    ],
  },
  "linha-editorial": {
    title: "Linha Editorial",
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
    title: "Persona — Perguntas Guiadas",
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
} as const;

type QuestionSectionKey = keyof typeof QUESTION_SECTIONS;

const MOODBOARD_KEYS: QuestionSectionKey[] = ["moodboard-identidade", "moodboard-visual", "moodboard-contexto", "moodboard-inspiracoes"];

const BRAND_ITEM_SECTIONS = [
  { type: "cor", label: "Cores da marca", icon: Paintbrush, placeholder: "Ex: #C4622D" },
  { type: "fonte", label: "Fontes", icon: Languages, placeholder: "Ex: Playfair Display" },
  { type: "tom", label: "Tom de voz", icon: MessageSquareText, placeholder: "Ex: Acolhedor e direto" },
  { type: "expressao", label: "Expressões que uso", icon: MessageSquare, placeholder: "Ex: Bora!" },
  { type: "evitar", label: "Palavras que evito", icon: Ban, placeholder: "Ex: Não use gírias" },
];

const Brandbook = () => {
  const { entries: moodboardEntries, isLoading: moodboardLoading, saveAnswer } = useMoodboard();
  const { brandItems, createBrandItem, deleteBrandItem: deleteBrandItemMutation, isLoading: brandLoading } = useBrandItems();
  const { persona: personaRow, savePersona: savePersonaMutation, isLoading: personaLoading } = usePersonas();

  const [answers, setAnswers] = useState<Record<string, EntryMap>>({});
  const [saving, setSaving] = useState(false);

  const [newItemName, setNewItemName] = useState("");
  const [newItemValue, setNewItemValue] = useState("");
  const [activeSection, setActiveSection] = useState("");

  const [persona, setPersona] = useState<PersonaData>({
    id: null, name: "Meu público principal", age_range: "", gender: "",
    location: "", interests: [], pain_points: [], desires: [], platforms: [], notes: "",
  });
  const [newTag, setNewTag] = useState("");

  const allSectionKeys = useMemo(() => Object.keys(QUESTION_SECTIONS) as QuestionSectionKey[], []);
  const loaded = !moodboardLoading && !brandLoading && !personaLoading;

  useEffect(() => {
    const grouped: Record<string, EntryMap> = {};
    allSectionKeys.forEach(k => { grouped[k] = {}; });
    moodboardEntries.forEach(e => {
      if (grouped[e.section]) grouped[e.section][e.question_key] = e.answer || "";
    });
    setAnswers(grouped);
  }, [moodboardEntries, allSectionKeys]);

  useEffect(() => {
    if (!personaRow) return;
    setPersona({
      id: personaRow.id,
      name: personaRow.name || "",
      age_range: personaRow.age_range || "",
      gender: personaRow.gender || "",
      location: personaRow.location || "",
      interests: personaRow.interests || [],
      pain_points: personaRow.pain_points || [],
      desires: personaRow.desires || [],
      platforms: personaRow.platforms || [],
      notes: personaRow.notes || "",
    });
  }, [personaRow]);

  const saveSection = useCallback(async (section: string) => {
    const config = QUESTION_SECTIONS[section as QuestionSectionKey];
    if (!config) return;
    setSaving(true);
    try {
      for (const q of config.questions) {
        await saveAnswer.mutateAsync({
          section,
          question_key: q.key,
          answer: answers[section]?.[q.key] || "",
        });
      }
      toast.success("Salvo com sucesso!");
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }, [answers, saveAnswer]);

  const addBrandItem = async (type: string) => {
    if (!newItemName.trim()) return;
    try {
      await createBrandItem.mutateAsync({
        type,
        name: newItemName.trim(),
        value: newItemValue || null,
        position: brandItems.filter(i => i.type === type).length,
      });
      setNewItemName(""); setNewItemValue("");
      toast.success("Item adicionado!");
    } catch {
      toast.error("Erro ao adicionar item.");
    }
  };

  const handleDeleteBrandItem = async (id: string) => {
    try {
      await deleteBrandItemMutation.mutateAsync(id);
    } catch {
      toast.error("Erro ao remover item.");
    }
  };

  const savePersona = async () => {
    try {
      const saved = await savePersonaMutation.mutateAsync({
        name: persona.name,
        age_range: persona.age_range || null,
        gender: persona.gender || null,
        location: persona.location || null,
        interests: persona.interests.length > 0 ? persona.interests : null,
        pain_points: persona.pain_points.length > 0 ? persona.pain_points : null,
        desires: persona.desires.length > 0 ? persona.desires : null,
        platforms: persona.platforms.length > 0 ? persona.platforms : null,
        notes: persona.notes || null,
      });
      if (saved?.id && !persona.id) {
        setPersona(prev => ({ ...prev, id: saved.id }));
      }
      toast.success("Persona salva!");
    } catch {
      toast.error("Erro ao salvar persona.");
    }
  };

  const addTagTo = (field: keyof PersonaData) => {
    if (!newTag.trim()) return;
    const arr = persona[field] as string[];
    if (arr.includes(newTag.trim())) return;
    setPersona(prev => ({ ...prev, [field]: [...(prev[field] as string[]), newTag.trim()] }));
    setNewTag("");
  };

  const removeTag = (field: keyof PersonaData, idx: number) => {
    setPersona(prev => ({ ...prev, [field]: (prev[field] as string[]).filter((_, i) => i !== idx) }));
  };

  // ─── Helpers ────────────────────────────────────────
  const handleChange = (section: string, key: string, value: string) => {
    setAnswers(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  const getSectionProgress = (section: string) => {
    const config = QUESTION_SECTIONS[section as QuestionSectionKey];
    if (!config) return 0;
    const qs = config.questions;
    const filled = qs.filter(q => (answers[section]?.[q.key] || "").trim().length > 0).length;
    return Math.round((filled / qs.length) * 100);
  };

  const buildPrompt = (section: string) => {
    const config = QUESTION_SECTIONS[section as QuestionSectionKey];
    if (!config || !("chatPrompt" in config)) return "";
    let prompt = (config as any).chatPrompt as string;
    config.questions.forEach(q => {
      const ans = answers[section]?.[q.key] || "(não respondido)";
      prompt += `\n${q.label}\n→ ${ans}\n`;
    });
    return prompt;
  };

  const getOverallProgress = () => {
    const allKeys = Object.keys(QUESTION_SECTIONS) as QuestionSectionKey[];
    const total = allKeys.reduce((sum, k) => sum + QUESTION_SECTIONS[k].questions.length, 0);
    const filled = allKeys.reduce((sum, k) => {
      return sum + QUESTION_SECTIONS[k].questions.filter(q => (answers[k]?.[q.key] || "").trim().length > 0).length;
    }, 0);
    const brandFilled = brandItems.length > 0 ? 1 : 0;
    const personaFilled = persona.name && persona.name !== "Meu público principal" ? 1 : 0;
    return Math.round(((filled + brandFilled + personaFilled) / (total + 2)) * 100);
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // ─── Render helpers ─────────────────────────────────
  const renderGuidedSection = (sectionKey: string, showChatPrompt = false) => {
    const config = QUESTION_SECTIONS[sectionKey as QuestionSectionKey];
    if (!config) return null;
    const progress = getSectionProgress(sectionKey);

    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1">
            <h3 className="text-base font-display font-semibold text-foreground">{config.title}</h3>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground font-body">{progress}%</span>
            <Progress value={progress} className="w-20 h-1.5 mt-1" />
          </div>
        </div>

        {config.questions.map((q, i) => (
          <motion.div key={q.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-body font-semibold text-foreground">{q.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={answers[sectionKey]?.[q.key] || ""}
                  onChange={(e) => handleChange(sectionKey, q.key, e.target.value)}
                  placeholder={q.placeholder}
                  className="min-h-[80px] resize-y font-body text-sm border-border rounded-xl"
                />
              </CardContent>
            </Card>
          </motion.div>
        ))}

        <div className="flex justify-end">
          <Button onClick={() => saveSection(sectionKey)} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        {showChatPrompt && "chatPrompt" in config && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Perguntar ao Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground font-body">
                Copie o prompt e cole no ChatGPT ou Claude para gerar um guia completo.
              </p>
              <div className="bg-card rounded-xl p-4 border border-border max-h-48 overflow-y-auto">
                <pre className="text-xs font-body text-foreground whitespace-pre-wrap">{buildPrompt(sectionKey)}</pre>
              </div>
              <CopyButton text={buildPrompt(sectionKey)} />
            </CardContent>
          </Card>
        )}
      </motion.div>
    );
  };

  return (
    <div className="max-w-4xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
              <BookMarked className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">
                Brandbook <InfoTooltip text="O Brandbook define a identidade da sua marca. As respostas aqui personalizam todas as sugestões da IA para o seu estilo e público." side="bottom" />
              </h1>
              <p className="text-muted-foreground font-body mt-0.5 text-sm">
                O centro estratégico da sua marca pessoal. Tudo que define quem você é como criador.
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs text-muted-foreground font-body">Completude geral</span>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={getOverallProgress()} className="w-28 h-2" />
              <span className="text-sm font-body font-semibold text-foreground">{getOverallProgress()}%</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="visao-geral">
          <div className="overflow-x-auto mb-6">
            <TabsList className="inline-flex h-auto bg-card border border-border rounded-2xl p-1.5 gap-1 min-w-max">
              <TabsTrigger value="visao-geral" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap">
                <Eye className="h-3.5 w-3.5" /> Visão Geral
              </TabsTrigger>
              <TabsTrigger value="moodboard" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap">
                <Heart className="h-3.5 w-3.5" /> Moodboard
              </TabsTrigger>
              <TabsTrigger value="linha-editorial" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap">
                <BookOpen className="h-3.5 w-3.5" /> Linha Editorial
              </TabsTrigger>
              <TabsTrigger value="persona" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap">
                <Users className="h-3.5 w-3.5" /> Persona
              </TabsTrigger>
              <TabsTrigger value="tom-de-voz" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap">
                <Mic className="h-3.5 w-3.5" /> Tom de Voz
              </TabsTrigger>
              <TabsTrigger value="identidade" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap">
                <Palette className="h-3.5 w-3.5" /> Identidade
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ═══ VISÃO GERAL ═══ */}
          <TabsContent value="visao-geral">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <BookMarked className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-display font-semibold text-foreground">Sua marca em um só lugar</h2>
                      <p className="text-sm text-muted-foreground font-body">
                        Preencha cada seção para construir uma identidade forte e consistente.
                      </p>
                    </div>
                  </div>
                  <Progress value={getOverallProgress()} className="h-2 mb-2" />
                  <p className="text-xs text-muted-foreground font-body">{getOverallProgress()}% completo</p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: "moodboard", label: "Moodboard", icon: Heart, desc: "Sensações, visual e inspirações", progress: Math.round(MOODBOARD_KEYS.reduce((s, k) => s + getSectionProgress(k), 0) / MOODBOARD_KEYS.length) },
                  { key: "linha-editorial", label: "Linha Editorial", icon: BookOpen, desc: "Temas, transformação e conteúdo", progress: getSectionProgress("linha-editorial") },
                  { key: "persona", label: "Persona", icon: Users, desc: "Quem é seu público", progress: persona.name && persona.name !== "Meu público principal" ? 60 : 0 },
                  { key: "tom-de-voz", label: "Tom de Voz", icon: Mic, desc: "Como você se comunica", progress: getSectionProgress("tom-de-voz") },
                  { key: "identidade", label: "Identidade", icon: Palette, desc: "Cores, fontes e elementos visuais", progress: brandItems.length > 0 ? Math.min(100, brandItems.length * 20) : 0 },
                ].map(item => (
                  <Card key={item.key} className="border-border hover:border-primary/30 transition-colors cursor-pointer group" onClick={() => {
                    const tabTrigger = document.querySelector(`[data-state][value="${item.key}"]`) as HTMLElement;
                    tabTrigger?.click();
                  }}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                          <item.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body font-semibold text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground font-body truncate">{item.desc}</p>
                        </div>
                      </div>
                      <Progress value={item.progress} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground font-body mt-1">{item.progress}% preenchido</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* ═══ MOODBOARD ═══ */}
          <TabsContent value="moodboard">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-semibold text-foreground">Moodboard</h2>
                  <p className="text-sm text-muted-foreground font-body">Defina a direção criativa e emocional da sua marca.</p>
                </div>
              </div>

              {MOODBOARD_KEYS.map(key => (
                <div key={key}>
                  {renderGuidedSection(key)}
                </div>
              ))}
            </motion.div>
          </TabsContent>

          {/* ═══ LINHA EDITORIAL ═══ */}
          <TabsContent value="linha-editorial">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-display font-semibold text-foreground">Linha Editorial</h2>
                <p className="text-sm text-muted-foreground font-body">Defina a essência do seu conteúdo.</p>
              </div>
            </div>
            {renderGuidedSection("linha-editorial", true)}
          </TabsContent>

          {/* ═══ PERSONA ═══ */}
          <TabsContent value="persona">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-semibold text-foreground">Persona / Público</h2>
                  <p className="text-sm text-muted-foreground font-body">Conheça profundamente quem te acompanha.</p>
                </div>
              </div>

              {/* Guided questions (persona-brand from moodboard_entries) */}
              {renderGuidedSection("persona-brand", true)}

              {/* Structured persona form */}
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary/70" /> Dados estruturados da persona
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Nome da persona</Label>
                    <Input placeholder="Ex: Maria, 28 anos" value={persona.name} onChange={e => setPersona(prev => ({ ...prev, name: e.target.value }))} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Faixa etária</Label>
                    <div className="flex gap-2 flex-wrap">
                      {["18-24", "25-34", "35-44", "45+"].map(a => (
                        <button key={a} onClick={() => setPersona(prev => ({ ...prev, age_range: prev.age_range === a ? "" : a }))}
                          className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${persona.age_range === a ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{a}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Gênero</Label>
                    <div className="flex gap-2 flex-wrap">
                      {["Mulheres", "Homens", "Todos"].map(g => (
                        <button key={g} onClick={() => setPersona(prev => ({ ...prev, gender: prev.gender === g ? "" : g }))}
                          className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${persona.gender === g ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{g}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Localização</Label>
                    <Input placeholder="Ex: Brasil, São Paulo" value={persona.location} onChange={e => setPersona(prev => ({ ...prev, location: e.target.value }))} className="rounded-xl" />
                  </div>

                  {([
                    { label: "Interesses", field: "interests" as const },
                    { label: "Dores principais", field: "pain_points" as const },
                    { label: "Desejos", field: "desires" as const },
                  ]).map(section => (
                    <div key={section.field} className="space-y-2">
                      <Label className="font-body text-sm">{section.label}</Label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(persona[section.field] as string[]).map((tag, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-lg text-xs font-body">
                            {tag}
                            <button onClick={() => removeTag(section.field, i)} className="hover:text-destructive">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input placeholder={`Adicionar ${section.label.toLowerCase()}...`} value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addTagTo(section.field); }} className="rounded-xl text-sm" />
                        <Button variant="outline" size="sm" onClick={() => addTagTo(section.field)}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}

                  <div className="space-y-2">
                    <Label className="font-body text-sm">Plataformas que usa</Label>
                    <div className="flex gap-2">
                      {(["instagram", "tiktok", "youtube"] as const).map(p => (
                        <button key={p} onClick={() => setPersona(prev => ({ ...prev, platforms: prev.platforms.includes(p) ? prev.platforms.filter(x => x !== p) : [...prev.platforms, p] }))}
                          className={`px-3 py-2 rounded-xl border transition-colors ${persona.platforms.includes(p) ? "bg-primary/10 border-primary" : "bg-background border-border"}`}>
                          <PlatformIcon platform={p} size="sm" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-body text-sm">Notas</Label>
                    <Textarea placeholder="Observações sobre seu público..." value={persona.notes} onChange={e => setPersona(prev => ({ ...prev, notes: e.target.value }))} className="rounded-xl min-h-[60px]" />
                  </div>

                  <Button variant="hero" onClick={savePersona} className="gap-2">
                    <Save className="h-4 w-4" /> Salvar persona
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ═══ TOM DE VOZ ═══ */}
          <TabsContent value="tom-de-voz">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mic className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-display font-semibold text-foreground">Tom de Voz</h2>
                <p className="text-sm text-muted-foreground font-body">Defina como você se comunica.</p>
              </div>
            </div>
            {renderGuidedSection("tom-de-voz", true)}
          </TabsContent>

          {/* ═══ IDENTIDADE DA MARCA ═══ */}
          <TabsContent value="identidade">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Palette className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-semibold text-foreground">Identidade da Marca</h2>
                  <p className="text-sm text-muted-foreground font-body">Cores, fontes, expressões e elementos visuais que compõem sua marca.</p>
                </div>
              </div>

              {BRAND_ITEM_SECTIONS.map(section => {
                const items = brandItems.filter(i => i.type === section.type);
                return (
                  <Card key={section.type} className="border-border shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                        <section.icon className="h-4 w-4 text-primary/70" />
                        {section.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {items.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {items.map(item => (
                            <div key={item.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-background rounded-xl border border-border">
                              {section.type === "cor" && item.value && <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.value }} />}
                              <span className="text-sm font-body text-foreground">{item.name}</span>
                              {item.value && section.type !== "cor" && <span className="text-xs text-muted-foreground font-body">({item.value})</span>}
                              <button onClick={() => handleDeleteBrandItem(item.id)} className="hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      {activeSection === section.type ? (
                        <div className="flex gap-2">
                          <Input placeholder="Nome" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="rounded-xl text-sm" />
                          <Input placeholder={section.placeholder} value={newItemValue} onChange={(e) => setNewItemValue(e.target.value)} className="rounded-xl text-sm" />
                          <Button size="sm" onClick={() => addBrandItem(section.type)} disabled={!newItemName.trim()}><Plus className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <button onClick={() => { setActiveSection(section.type); setNewItemName(""); setNewItemValue(""); }} className="text-sm text-primary font-body font-medium hover:underline">+ Adicionar</button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Brandbook;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Users, Mic, Save, Sparkles, Eye, Palette, Heart, Paintbrush, Languages, MessageSquareText, MessageSquare, Ban, Plus, Trash2, BookMarked, Download, Pencil, Bot, Wand2, Trophy, SmilePlus, Crown, Briefcase, type LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CopyButton } from "@/components/shared/CopyButton";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { toast } from "sonner";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { useBrandItems } from "@/hooks/useBrandItems";
import { BrandbookImport, type CampoDef } from "@/components/brandbook/BrandbookImport";
import { useMoodboard } from "@/hooks/useMoodboard";
import { usePersonas, MAX_PERSONAS } from "@/hooks/usePersonas";
import { usePillars } from "@/hooks/usePillars";
import { useProfile } from "@/hooks/useProfile";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePdfExport } from "@/hooks/usePdfExport";
import { cn } from "@/lib/utils";
import { BrandHubOverview } from "@/components/brandbook/BrandHubOverview";
import { GuidedSection } from "@/components/brandbook/GuidedSection";
import { BrandValuesSection } from "@/components/brandbook/BrandValuesSection";
import { PersonaStructuredForm, type TagField } from "@/components/brandbook/PersonaStructuredForm";
import { MoodboardSection } from "@/components/brandbook/MoodboardSection";
import { EditorialSection } from "@/components/brandbook/EditorialSection";
import { BrandPdfTemplate } from "@/components/pdf/BrandPdfTemplate";

interface EntryMap { [key: string]: string }
interface PersonaData {
  id: string | null;
  name: string;
  icon: string;
  age_range: string;
  gender: string;
  location: string;
  interests: string[];
  pain_points: string[];
  desires: string[];
  objections: string[];
  how_you_help: string;
  platforms: string[];
  notes: string;
}

const PERSONA_ICON_MAP: Record<string, LucideIcon> = {
  bot: Bot, wand: Wand2, trophy: Trophy, smile: SmilePlus, crown: Crown, briefcase: Briefcase,
};

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
  "visao-de-mundo": {
    title: "Visão de Mundo",
    questions: [
      { key: "verdade-pouco-dita", label: "Que verdade você acredita que poucas pessoas do seu nicho falam?", placeholder: "Ex: Que estilo não tem a ver com dinheiro, é repertório e intenção..." },
      { key: "crenca-a-quebrar", label: "Que crença você quer quebrar no seu público?", placeholder: "Ex: A ideia de que 'corpo bonito é só um tipo de corpo'..." },
      { key: "incomodo-mercado", label: "Que comportamento do mercado mais te incomoda?", placeholder: "Ex: Vender insegurança disfarçada de solução, copy genérico, promessa milagrosa..." },
    ],
  },
  "sobre-voce": {
    title: "Sobre Você",
    questions: [
      { key: "comeco", label: "O que fez você querer começar a criar conteúdo?", placeholder: "Ex: Cansei de não me ver representada e percebi que outras mulheres sentiam o mesmo..." },
      { key: "conflito", label: "Que conflito você viveu que hoje quer ajudar outras pessoas?", placeholder: "Ex: Passei anos achando que era 'sem estilo' porque não cabia no padrão..." },
      { key: "meta", label: "Onde você quer chegar? Qual é sua meta com a criação de conteúdo?", placeholder: "Ex: Construir uma comunidade de 100 mil mulheres se sentindo bem com elas mesmas..." },
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
    title: "Persona, Perguntas Guiadas",
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

const MOODBOARD_KEYS: QuestionSectionKey[] = ["moodboard-identidade", "moodboard-visual", "moodboard-contexto", "moodboard-inspiracoes", "visao-de-mundo", "sobre-voce"];

const BRAND_ITEM_SECTIONS = [
  { type: "cor", label: "Cores da marca", icon: Paintbrush, placeholder: "Ex: #C4622D" },
  { type: "fonte", label: "Fontes", icon: Languages, placeholder: "Ex: Playfair Display" },
  { type: "tom", label: "Tom de voz", icon: MessageSquareText, placeholder: "Ex: Acolhedor e direto" },
  { type: "expressao", label: "Expressões que uso", icon: MessageSquare, placeholder: "Ex: Bora!" },
  { type: "evitar", label: "Palavras que evito", icon: Ban, placeholder: "Ex: Não use gírias" },
];

/* Os campos que a gente importa pro criador e ESPALHA nas seções do brandbook.
   Cada chave abaixo tem um destino certo (ver distribuirDoPdf): cor/fonte vão
   pra Identidade; direção visual pro Visual; tom e o que evitar pro Tom de Voz;
   personalidade pra Identidade; diferencial pros Valores; temas pra Comunicação;
   público vira uma persona. Assim um único upload preenche o brandbook inteiro,
   não só a aba Identidade. */
const CAMPOS_CRIADOR: CampoDef[] = [
  { chave: "colorPalette", rotulo: "Cores da marca", ajuda: "os hex" },
  { chave: "typography", rotulo: "Fontes" },
  { chave: "visualExpression", rotulo: "Direção visual", ajuda: "tipo de imagem, luz, composição", multi: true },
  { chave: "toneOfVoice", rotulo: "Tom de voz", multi: true },
  { chave: "avoid", rotulo: "Palavras e coisas que você evita", multi: true },
  { chave: "personality", rotulo: "Personalidade e palavras-chave", multi: true },
  { chave: "valueProp", rotulo: "Diferencial e propósito", multi: true },
  { chave: "contentThemes", rotulo: "Temas de conteúdo", multi: true },
  { chave: "audience", rotulo: "Público-alvo", multi: true },
  // Persona estruturada: cada um vira um campo da persona (ver distribuirDoPdf).
  { chave: "personaPains", rotulo: "Dores do público", multi: true },
  { chave: "personaDesires", rotulo: "Desejos do público", multi: true },
  { chave: "personaObjections", rotulo: "Objeções do público", multi: true },
  { chave: "personaInterests", rotulo: "Interesses do público", multi: true },
  { chave: "personaChannels", rotulo: "Canais do público", multi: true },
];

const Brandbook = () => {
  const { entries: moodboardEntries, isLoading: moodboardLoading, saveAnswer } = useMoodboard();
  const { brandItems, createBrandItem, deleteBrandItem: deleteBrandItemMutation, isLoading: brandLoading } = useBrandItems();
  const {
    personas,
    savePersona: savePersonaMutation,
    deletePersona: deletePersonaMutation,
    isLoading: personaLoading,
  } = usePersonas();
  const { pillars } = usePillars();
  const { profile } = useProfile();
  // Brandbook é da CONTA ATIVA, nome/nicho no PDF e no slug refletem ela.
  const { profile: activeProfile } = useActiveProfile();
  const { exportPdf } = usePdfExport();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const [answers, setAnswers] = useState<Record<string, EntryMap>>({});
  const [activeTab, setActiveTab] = useState<string>("visao-geral");

  const countSectionAnswers = useCallback((sectionKey: string) => {
    const config = QUESTION_SECTIONS[sectionKey as QuestionSectionKey];
    if (!config) return 0;
    const sectionAnswers = answers[sectionKey] ?? {};
    return config.questions.filter(q => (sectionAnswers[q.key] ?? "").trim().length > 0).length;
  }, [answers]);
  const [saving, setSaving] = useState(false);

  const [newItemName, setNewItemName] = useState("");
  const [newItemValue, setNewItemValue] = useState("");
  const [activeSection, setActiveSection] = useState("");

  const emptyPersona: PersonaData = {
    id: null, name: "", icon: "bot", age_range: "", gender: "",
    location: "", interests: [], pain_points: [], desires: [], objections: [], how_you_help: "", platforms: [], notes: "",
  };
  const [editingPersona, setEditingPersona] = useState<PersonaData | null>(null);
  const [deletingPersonaId, setDeletingPersonaId] = useState<string | null>(null);
  const [savingPersona, setSavingPersona] = useState(false);

  const allSectionKeys = useMemo(() => Object.keys(QUESTION_SECTIONS) as QuestionSectionKey[], []);
  const loaded = !moodboardLoading && !brandLoading && !personaLoading;

  const answersHydratedRef = useRef(false);

  useEffect(() => {
    if (answersHydratedRef.current || moodboardLoading) return;
    const grouped: Record<string, EntryMap> = {};
    allSectionKeys.forEach(k => { grouped[k] = {}; });
    moodboardEntries.forEach(e => {
      if (grouped[e.section]) grouped[e.section][e.question_key] = e.answer || "";
    });
    setAnswers(grouped);
    answersHydratedRef.current = true;
  }, [moodboardEntries, allSectionKeys, moodboardLoading]);

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

  /* ═════════════════════════════════════════════════════════════════════════
     IMPORTAR O BRANDBOOK DE UM (OU DOIS) PDF/IMAGEM E DISTRIBUIR NAS SEÇÕES

     A leitura do arquivo não cai só na aba Identidade: cada pedaço vai pro lugar
     que o Cria pré-determinou, exatamente como os cards do topo (BrandHubOverview):

       Identidade  → brand_items (cor) + moodboard-identidade/palavras-chave
       Visual      → brand_items (cor, fonte) + moodboard-visual/cores, /estetica
       Comunicação → linha-editorial/temas
       Público     → personas (cria UMA persona se ainda não houver)
       Valores     → moodboard-contexto/diferencial
       Tom de Voz  → brand_items (tom, evitar) + tom-de-voz/estilo, /evitar

     DUAS REGRAS QUE NÃO SE NEGOCIAM:
     1. brand_items: só ACRESCENTA o que ainda não está lá (nunca duplica).
     2. Perguntas guiadas e persona: só preenche o VAZIO. Onde a pessoa já
        escreveu à mão, a leitura automática NÃO sobrescreve. Apagar a mão dela
        é o jeito mais rápido de ela nunca mais usar isto.
     ═════════════════════════════════════════════════════════════════════════ */
  const identidadeAtual = useMemo(() => ({
    colorPalette: brandItems.filter((i) => i.type === "cor").map((i) => i.name).join(", "),
    typography: brandItems.filter((i) => i.type === "fonte").map((i) => i.name).join(", "),
    toneOfVoice: brandItems.filter((i) => i.type === "tom").map((i) => i.name).join(", "),
    avoid: brandItems.filter((i) => i.type === "evitar").map((i) => i.name).join(", "),
    visualExpression: answers["moodboard-visual"]?.["estetica"] ?? "",
    personality: answers["moodboard-identidade"]?.["palavras-chave"] ?? "",
    valueProp: answers["moodboard-contexto"]?.["diferencial"] ?? "",
    contentThemes: answers["linha-editorial"]?.["temas"] ?? "",
    audience: personas[0]?.notes ?? personas[0]?.name ?? "",
    // Persona estruturada (antes → depois): junta com "; " pra bater com o parse.
    personaPains: (personas[0]?.pain_points ?? []).join("; "),
    personaDesires: (personas[0]?.desires ?? []).join("; "),
    personaObjections: (personas[0]?.objections ?? []).join("; "),
    personaInterests: (personas[0]?.interests ?? []).join("; "),
    personaChannels: (personas[0]?.platforms ?? []).join("; "),
  }), [brandItems, answers, personas]);

  const distribuirDoPdf = async (valores: Record<string, string>) => {
    const paraLista = (v?: string) =>
      (v ?? "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

    // 1) Itens de marca (Identidade/Visual/Tom): cor, fonte, tom, evitar. Só acrescenta.
    const planos: { type: string; nomes: string[] }[] = [
      { type: "cor", nomes: paraLista(valores.colorPalette) },
      { type: "fonte", nomes: paraLista(valores.typography) },
      // Tom e "evitar" são frases, não listas: quebrar por vírgula picotaria a frase.
      { type: "tom", nomes: valores.toneOfVoice?.trim() ? [valores.toneOfVoice.trim()] : [] },
      { type: "evitar", nomes: valores.avoid?.trim() ? [valores.avoid.trim()] : [] },
    ];

    let novos = 0;
    for (const p of planos) {
      const jaTem = new Set(
        brandItems.filter((i) => i.type === p.type).map((i) => i.name.trim().toLowerCase()),
      );
      for (const nome of p.nomes) {
        if (jaTem.has(nome.toLowerCase())) continue; // não duplica
        await createBrandItem.mutateAsync({
          type: p.type,
          name: nome,
          value: null,
          position: brandItems.filter((i) => i.type === p.type).length + novos,
        });
        novos++;
      }
    }

    // 2) Perguntas guiadas (Visual, Identidade, Valores, Comunicação, Tom).
    //    Só preenche o campo VAZIO nunca apaga o que a pessoa escreveu à mão.
    const guiados: { section: string; key: string; valor?: string }[] = [
      { section: "moodboard-visual", key: "cores", valor: valores.colorPalette },
      { section: "moodboard-visual", key: "estetica", valor: valores.visualExpression },
      { section: "moodboard-identidade", key: "palavras-chave", valor: valores.personality },
      { section: "moodboard-contexto", key: "diferencial", valor: valores.valueProp },
      { section: "linha-editorial", key: "temas", valor: valores.contentThemes },
      { section: "tom-de-voz", key: "estilo", valor: valores.toneOfVoice },
      { section: "tom-de-voz", key: "evitar", valor: valores.avoid },
    ];

    let preenchidos = 0;
    const novosAnswers: Record<string, EntryMap> = { ...answers };
    for (const g of guiados) {
      const v = (g.valor ?? "").trim();
      if (!v) continue;
      const jaEscrito = (answers[g.section]?.[g.key] ?? "").trim();
      if (jaEscrito) continue; // respeita o que já estava preenchido
      await saveAnswer.mutateAsync({ section: g.section, question_key: g.key, answer: v });
      novosAnswers[g.section] = { ...(novosAnswers[g.section] ?? {}), [g.key]: v };
      preenchidos++;
    }
    if (preenchidos > 0) setAnswers(novosAnswers);

    // 3) Público-alvo: cria UMA persona a partir do que o arquivo trouxe, só se
    //    ainda não existir nenhuma. Nunca mexe numa persona que a pessoa criou.
    //    Agora a persona vem ESTRUTURADA: dores, desejos, objeções, interesses e
    //    canais viram arrays nos campos certos (não mais só um texto solto).
    //    Listas de frases quebram só por ";" e quebra de linha vírgula picotaria
    //    frases tipo "acha caro, não confia".
    const paraFrases = (v?: string) =>
      (v ?? "").split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);

    let personaCriada = false;
    const publico = (valores.audience ?? "").trim();
    const dores = paraFrases(valores.personaPains);
    const desejos = paraFrases(valores.personaDesires);
    const objecoes = paraFrases(valores.personaObjections);
    const interesses = paraFrases(valores.personaInterests);
    const canais = paraFrases(valores.personaChannels);
    const temPersona = publico || dores.length || desejos.length || objecoes.length || interesses.length || canais.length;
    if (temPersona && personas.length === 0) {
      await savePersonaMutation.mutateAsync({
        name: "Público principal",
        icon: "bot",
        notes: publico || null,
        pain_points: dores.length ? dores : null,
        desires: desejos.length ? desejos : null,
        objections: objecoes.length ? objecoes : null,
        interests: interesses.length ? interesses : null,
        platforms: canais.length ? canais : null,
      });
      personaCriada = true;
    }

    const total = novos + preenchidos + (personaCriada ? 1 : 0);
    toast.success(
      total > 0
        ? `Brandbook atualizado: ${total} ${total === 1 ? "campo preenchido" : "campos preenchidos"} nas seções certas.`
        : "Nada de novo pra adicionar, o que o arquivo trouxe você já tinha.",
    );
  };

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
    if (!editingPersona) return;
    if (!editingPersona.name.trim()) {
      toast.error("Dê um nome para a persona.");
      return;
    }
    setSavingPersona(true);
    try {
      await savePersonaMutation.mutateAsync({
        id: editingPersona.id ?? undefined,
        name: editingPersona.name.trim(),
        icon: editingPersona.icon || "bot",
        age_range: editingPersona.age_range || null,
        gender: editingPersona.gender || null,
        location: editingPersona.location || null,
        interests: editingPersona.interests.length > 0 ? editingPersona.interests : null,
        pain_points: editingPersona.pain_points.length > 0 ? editingPersona.pain_points : null,
        desires: editingPersona.desires.length > 0 ? editingPersona.desires : null,
        objections: editingPersona.objections.length > 0 ? editingPersona.objections : null,
        how_you_help: editingPersona.how_you_help || null,
        platforms: editingPersona.platforms.length > 0 ? editingPersona.platforms : null,
        notes: editingPersona.notes || null,
      });
      toast.success("Persona salva!");
      setEditingPersona(null);
    } catch {
      toast.error("Erro ao salvar persona.");
    } finally {
      setSavingPersona(false);
    }
  };

  const handleConfirmDeletePersona = async () => {
    if (!deletingPersonaId) return;
    try {
      await deletePersonaMutation.mutateAsync(deletingPersonaId);
      toast.success("Persona removida.");
    } catch {
      toast.error("Erro ao remover persona.");
    } finally {
      setDeletingPersonaId(null);
    }
  };

  const openNewPersona = () => {
    setEditingPersona({ ...emptyPersona, name: `Persona ${personas.length + 1}` });
  };

  const openEditPersona = (id: string) => {
    const target = personas.find(p => p.id === id);
    if (!target) return;
    setEditingPersona({
      id: target.id,
      name: target.name || "",
      icon: target.icon || "bot",
      age_range: target.age_range || "",
      gender: target.gender || "",
      location: target.location || "",
      interests: target.interests || [],
      pain_points: target.pain_points || [],
      desires: target.desires || [],
      objections: target.objections || [],
      how_you_help: target.how_you_help || "",
      platforms: target.platforms || [],
      notes: target.notes || "",
    });
  };

  const addTagTo = (field: TagField, value: string) => {
    if (!editingPersona) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const arr = editingPersona[field] as string[];
    if (arr.includes(trimmed)) return;
    setEditingPersona(prev => prev ? { ...prev, [field]: [...(prev[field] as string[]), trimmed] } : prev);
  };

  const removeTag = (field: TagField, idx: number) => {
    setEditingPersona(prev => prev ? { ...prev, [field]: (prev[field] as string[]).filter((_, i) => i !== idx) } : prev);
  };

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const slug = (activeProfile?.name || "brandbook").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      await exportPdf(pdfRef, `brandbook-${slug || "creator"}`);
      toast.success("PDF exportado!");
    } catch {
      toast.error("Erro ao exportar PDF.");
    } finally {
      setExporting(false);
    }
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
    let prompt = (config as { chatPrompt: string }).chatPrompt;
    config.questions.forEach((q: { key: string; label: string }) => {
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
    const personaFilled = personas.length > 0 ? 1 : 0;
    return Math.round(((filled + brandFilled + personaFilled) / (total + 2)) * 100);
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const renderGuidedSection = (sectionKey: string, showChatPrompt = false) => {
    const config = QUESTION_SECTIONS[sectionKey as QuestionSectionKey];
    if (!config) return null;
    return (
      <GuidedSection
        sectionKey={sectionKey}
        title={config.title}
        questions={config.questions}
        answers={answers[sectionKey] ?? {}}
        progress={getSectionProgress(sectionKey)}
        saving={saving}
        onAnswerChange={(key, value) => handleChange(sectionKey, key, value)}
        onSave={() => saveSection(sectionKey)}
        chatPrompt={showChatPrompt && "chatPrompt" in config ? buildPrompt(sectionKey) : null}
      />
    );
  };

  return (
    <div className="max-w-4xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0 md:hidden">
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
          <div className="flex items-center gap-3 shrink-0">
            <Button
              data-tour="brandbook-importar"
              variant="default"
              size="sm"
              onClick={() => {
                // Leva pra Visão Geral e rola até o bloco de importar (o card fica
                // logo no topo). Torna o upload acessível de qualquer aba.
                setActiveTab("visao-geral");
                requestAnimationFrame(() =>
                  document.getElementById("brandbook-importar")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                );
              }}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Importar de PDF</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={exporting}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{exporting ? "Exportando..." : "Exportar PDF"}</span>
            </Button>
            <div className="text-right hidden sm:block">
              <span className="text-xs text-muted-foreground font-body">Completude geral</span>
              <div className="flex items-center gap-2 mt-1">
                <Progress value={getOverallProgress()} className="w-28 h-2" />
                <span className="text-sm font-body font-semibold text-foreground">{getOverallProgress()}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Wrapper só pra ancorar o tour: o BrandHubOverview não repassa props. */}
        <div data-tour="brandbook-hub">
          <BrandHubOverview
            counts={{
              identidade: countSectionAnswers("moodboard-identidade"),
              visual: countSectionAnswers("moodboard-visual") + brandItems.length,
              comunicacao: countSectionAnswers("linha-editorial"),
              publico: personas.length,
              valores: countSectionAnswers("moodboard-contexto"),
              tom: countSectionAnswers("tom-de-voz"),
            }}
            onSelect={setActiveTab}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto mb-6">
            <TabsList data-tour="brandbook-abas" className="inline-flex h-auto bg-card border border-border rounded-2xl p-1.5 gap-1 min-w-max">
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
              {/* IMPORTAR DE PDF proeminente, logo na entrada.
                  Antes vivia escondido só na aba Identidade. Aqui é a primeira
                  coisa que a pessoa vê, e a leitura preenche o brandbook INTEIRO
                  (cores, fontes, tom, visual, valores, temas e público), não só
                  a Identidade. */}
              <div id="brandbook-importar" className="scroll-mt-24">
                <BrandbookImport
                  alvo="criador"
                  campos={CAMPOS_CRIADOR}
                  atual={identidadeAtual}
                  titulo="Importar de PDF: o Cria preenche o brandbook todo"
                  descricao="Sobe seu manual de marca, moodboard ou um print da paleta (até 2 arquivos). A gente lê e distribui nas seções certas: cores, fontes, tom de voz, visual, valores, temas e público. Você só confere."
                  onSalvar={distribuirDoPdf}
                />
              </div>

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
                  { key: "persona", label: "Persona", icon: Users, desc: "Quem é seu público", progress: Math.min(100, personas.length * Math.round(100 / MAX_PERSONAS)) },
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
            <MoodboardSection moodboardSectionKeys={MOODBOARD_KEYS} renderGuided={renderGuidedSection} />
          </TabsContent>

          {/* ═══ LINHA EDITORIAL ═══ */}
          <TabsContent value="linha-editorial">
            <EditorialSection>{renderGuidedSection("linha-editorial", true)}</EditorialSection>
          </TabsContent>

          {/* ═══ PERSONA ═══ */}
          <TabsContent value="persona">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-semibold text-foreground">Personas</h2>
                    <p className="text-sm text-muted-foreground font-body">
                      Mapeie quem te acompanha. Até {MAX_PERSONAS} personas.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={openNewPersona}
                  disabled={personas.length >= MAX_PERSONAS}
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Nova Persona
                </Button>
              </div>

              {personas.length === 0 ? (
                <Card className="border-dashed border-border">
                  <CardContent className="py-12 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm font-body text-foreground mb-1">Nenhuma persona ainda</p>
                    <p className="text-xs text-muted-foreground font-body mb-4">
                      Crie sua primeira persona para personalizar as sugestões da IA.
                    </p>
                    <Button onClick={openNewPersona} size="sm" variant="outline" className="gap-1.5">
                      <Plus className="h-4 w-4" /> Criar persona
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personas.map(p => {
                    const firstPain = p.pain_points?.[0];
                    const PersonaIcon = PERSONA_ICON_MAP[p.icon ?? "bot"] ?? Bot;
                    return (
                      <Card key={p.id} className="border-border shadow-sm hover:border-primary/30 transition-colors">
                        <CardContent className="pt-5 pb-4 flex flex-col gap-3">
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <PersonaIcon className="h-6 w-6" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-body font-semibold text-foreground truncate">{p.name || "Persona sem nome"}</p>
                              {firstPain ? (
                                <p className="text-xs text-muted-foreground font-body mt-1 line-clamp-2">
                                  <span className="text-muted-foreground/70">Dor: </span>{firstPain}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground/60 font-body mt-1 italic">Sem dores cadastradas</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1.5"
                              onClick={() => openEditPersona(p.id)}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setDeletingPersonaId(p.id)}
                              aria-label={`Excluir ${p.name || "persona"}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Insights de audiência (compartilhados, persona-brand do moodboard) */}
              <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm font-body text-foreground/80 leading-relaxed">
                  💡 <strong className="text-foreground">Não sabe quem é a sua persona?</strong>{" "}
                  Preencha as informações abaixo com o que você sabe até agora e peça ajuda
                  ao ChatGPT ou Claude, eles vão te ajudar a construir sua persona ideal
                  com base nas suas respostas.
                </p>
              </div>
              {renderGuidedSection("persona-brand", true)}
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
            {/* SUBIR O BRANDBOOK EM PDF.
                Preencher cor por cor, fonte por fonte, é o que faz esta aba
                ficar vazia e brandbook vazio faz TODA a IA do Cria (legenda,
                roteiro, prompt de arte) sair genérica. Quem já tem um moodboard
                em PDF não devia digitar nada: sobe o arquivo e confere. */}
            <div className="mb-5">
              <BrandbookImport
                alvo="criador"
                campos={CAMPOS_CRIADOR}
                atual={identidadeAtual}
                titulo="Já tem sua identidade num PDF? Sobe aqui."
                descricao="Se você tem um manual de marca, moodboard ou até um print da sua paleta, a gente lê as cores, as fontes e o seu tom de voz e você só confere. Pode subir até 2 arquivos."
                onSalvar={distribuirDoPdf}
              />
            </div>
            <BrandValuesSection
              brandItems={brandItems}
              activeSection={activeSection}
              newItemName={newItemName}
              newItemValue={newItemValue}
              onActiveSectionChange={setActiveSection}
              onNewItemNameChange={setNewItemName}
              onNewItemValueChange={setNewItemValue}
              onAddBrandItem={addBrandItem}
              onDeleteBrandItem={handleDeleteBrandItem}
            />
          </TabsContent>
        </Tabs>
      </motion.div>

      <Dialog open={editingPersona !== null} onOpenChange={(open) => { if (!open) setEditingPersona(null); }}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingPersona?.id ? "Editar persona" : "Nova persona"}
            </DialogTitle>
            <DialogDescription>
              Detalhe quem é essa pessoa. Quanto mais específico, melhor a IA personaliza as sugestões.
            </DialogDescription>
          </DialogHeader>

          {editingPersona && (
            <div className="mt-6">
              <PersonaStructuredForm
                persona={editingPersona}
                onPersonaChange={(next) => setEditingPersona(prev => prev ? (typeof next === "function" ? next(prev) : next) : prev)}
                onAddTag={addTagTo}
                onRemoveTag={removeTag}
                onSave={savePersona}
              />
              {savingPersona && (
                <p className="text-xs text-muted-foreground font-body mt-3 text-center">Salvando...</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingPersonaId !== null} onOpenChange={(open) => { if (!open) setDeletingPersonaId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir persona?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação remove a persona permanentemente. Não dá pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeletePersona} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }} aria-hidden="true">
        <BrandPdfTemplate
          ref={pdfRef}
          profile={activeProfile}
          brandItems={brandItems}
          personas={personas}
          pillars={pillars}
          moodboardEntries={moodboardEntries}
        />
      </div>
    </div>
  );
};

export default Brandbook;

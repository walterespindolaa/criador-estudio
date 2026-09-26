import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Users, Mic, Palette, Plus, Trash2, BookMarked, Download, Pencil, Bot, Wand2, Trophy, SmilePlus, Crown,
  Briefcase, UserRound, ArrowRight, Check, Loader2, Compass, Eye, Heart, Lightbulb, Sparkles, type LucideIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { useBrandItems } from "@/hooks/useBrandItems";
import { BrandbookImport, type CampoDef } from "@/components/brandbook/BrandbookImport";
import { useMoodboard } from "@/hooks/useMoodboard";
import { usePersonas, MAX_PERSONAS } from "@/hooks/usePersonas";
import { usePillars } from "@/hooks/usePillars";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePdfExport } from "@/hooks/usePdfExport";
import { cn } from "@/lib/utils";
import { GuidedSection } from "@/components/brandbook/GuidedSection";
import { BrandValuesSection } from "@/components/brandbook/BrandValuesSection";
import { PersonaStructuredForm, type TagField } from "@/components/brandbook/PersonaStructuredForm";
import { QUESTION_SECTIONS, idDaPergunta, type QuestionSectionKey } from "@/lib/brandbook-perguntas";
import { PilaresSection } from "@/components/brandbook/PilaresSection";
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

/* ═══════════════════════════════════════════════════════════════════════════
   AS CINCO ABAS (Walter, 20/09/2026: "muito esquisita e confusa")

   A tela tinha três camadas de navegação que não falavam a mesma língua: seis
   cards no topo (Identidade, Visual, Comunicação, Público, Valores, Tom), seis
   abas com OUTROS nomes (Moodboard, Linha Editorial, Persona...), e dentro da
   Visão Geral mais cinco cards com barras. "Identidade" no card de cima era
   as perguntas de sensação; "Identidade" na aba era cores e fontes. Três
   barras de progresso mediam três coisas diferentes.

   Agora é uma camada só: cinco abas, com contador, na ordem em que uma marca
   se constrói. É o mesmo desenho do brandbook do cliente que a social mídia
   usa (pílulas com feitos/total), que é a tela que o Walter apontou como a
   boa. As chaves das seções no banco NÃO mudaram; só o agrupamento na tela.
   ═══════════════════════════════════════════════════════════════════════════ */
/* CADA ABA TEM UMA COR (Walter, 20/09/2026: "dar um pouco mais de vida").
   As classes vêm escritas por inteiro, e não montadas com template, porque o
   Tailwind só gera o CSS do que ele lê no código. */
type CorDaAba = {
  /** A pílula ativa: fundo cheio. */
  ativa: string;
  /** O ícone na pílula inativa e no card do grupo. */
  badge: string;
  /** O contador quando o grupo está completo. */
  feito: string;
  /** A faixa de introdução da aba. */
  faixa: string;
};

type Aba = {
  valor: string;
  rotulo: string;
  icone: LucideIcon;
  /** A frase que abre a aba: pra que servem estas respostas. */
  intro: string;
  secoes: readonly QuestionSectionKey[];
  cor: CorDaAba;
};

const ABAS: readonly Aba[] = [
  {
    valor: "essencia", rotulo: "Quem você é", icone: UserRound,
    intro: "Sua história, seu porquê e o que você acredita. É daqui que a IA tira a voz de quem fala, não só o assunto.",
    secoes: ["sobre-voce", "moodboard-contexto", "visao-de-mundo"],
    cor: { ativa: "data-[state=active]:bg-amber-600 data-[state=active]:border-amber-600", badge: "bg-amber-100 text-amber-700", feito: "bg-amber-100 text-amber-800", faixa: "bg-amber-50 border-amber-100 text-amber-950/80" },
  },
  {
    valor: "identidade", rotulo: "Identidade", icone: Palette,
    intro: "Como a marca se sente e se parece: sensações, estética, cores, fontes e o que te inspira.",
    secoes: ["moodboard-identidade", "moodboard-visual", "moodboard-inspiracoes"],
    cor: { ativa: "data-[state=active]:bg-violet-600 data-[state=active]:border-violet-600", badge: "bg-violet-100 text-violet-700", feito: "bg-violet-100 text-violet-800", faixa: "bg-violet-50 border-violet-100 text-violet-950/80" },
  },
  {
    valor: "linha-editorial", rotulo: "Linha editorial", icone: BookOpen,
    intro: "Sobre o que você fala. Os pilares em cima, e as perguntas embaixo ajudam a chegar neles.",
    secoes: ["linha-editorial"],
    cor: { ativa: "data-[state=active]:bg-sky-600 data-[state=active]:border-sky-600", badge: "bg-sky-100 text-sky-700", feito: "bg-sky-100 text-sky-800", faixa: "bg-sky-50 border-sky-100 text-sky-950/80" },
  },
  {
    valor: "persona", rotulo: "Persona", icone: Users,
    intro: "Pra quem você fala. Cadastre a pessoa e responda o que sabe dela; o resto a IA ajuda a montar.",
    secoes: ["persona-brand"],
    cor: { ativa: "data-[state=active]:bg-emerald-600 data-[state=active]:border-emerald-600", badge: "bg-emerald-100 text-emerald-700", feito: "bg-emerald-100 text-emerald-800", faixa: "bg-emerald-50 border-emerald-100 text-emerald-950/80" },
  },
  {
    valor: "tom-de-voz", rotulo: "Tom de voz", icone: Mic,
    intro: "Como você fala. As etiquetas curtas vão primeiro pro prompt; as respostas longas dão o contexto.",
    secoes: ["tom-de-voz"],
    cor: { ativa: "data-[state=active]:bg-rose-600 data-[state=active]:border-rose-600", badge: "bg-rose-100 text-rose-700", feito: "bg-rose-100 text-rose-800", faixa: "bg-rose-50 border-rose-100 text-rose-950/80" },
  },
];

/** Um ícone por grupo de perguntas. A cor vem da aba. */
const ICONE_DA_SECAO: Record<QuestionSectionKey, LucideIcon> = {
  "sobre-voce": UserRound,
  "moodboard-contexto": Compass,
  "visao-de-mundo": Eye,
  "moodboard-identidade": Heart,
  "moodboard-visual": Palette,
  "moodboard-inspiracoes": Lightbulb,
  "linha-editorial": BookOpen,
  "persona-brand": Users,
  "tom-de-voz": Mic,
};

/** Uma frase por grupo de perguntas, mostrada no cabeçalho do card. */
const INTRO_DA_SECAO: Partial<Record<QuestionSectionKey, string>> = {
  "sobre-voce": "A trajetória que te trouxe até aqui.",
  "moodboard-contexto": "Por que você cria e o que quer deixar.",
  "visao-de-mundo": "As opiniões que fazem seu conteúdo ter posição.",
  "moodboard-identidade": "O que a pessoa sente quando encontra sua marca.",
  "moodboard-visual": "Direção estética, em palavras.",
  "moodboard-inspiracoes": "De onde vêm suas referências.",
  "linha-editorial": "Ideia central, temas e formatos.",
  "persona-brand": "O que você já sabe de quem te acompanha.",
  "tom-de-voz": "Estilo, vocabulário e o que fica de fora.",
};

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
  // Brandbook é da CONTA ATIVA, nome/nicho no PDF e no slug refletem ela.
  const { profile: activeProfile } = useActiveProfile();
  const { exportPdf } = usePdfExport();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const [answers, setAnswers] = useState<Record<string, EntryMap>>({});
  const [activeTab, setActiveTab] = useState<string>(ABAS[0].valor);

  const [newItemName, setNewItemName] = useState("");
  const [newItemValue, setNewItemValue] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

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
  /* O que está GRAVADO, por pergunta. É a comparação que decide se sair do
     campo precisa ir ao banco: sem isso, cada clique fora de um campo intocado
     viraria um upsert. */
  const persistidoRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (answersHydratedRef.current || moodboardLoading) return;
    const grouped: Record<string, EntryMap> = {};
    allSectionKeys.forEach(k => { grouped[k] = {}; });
    moodboardEntries.forEach(e => {
      if (grouped[e.section]) {
        grouped[e.section][e.question_key] = e.answer || "";
        persistidoRef.current[`${e.section}/${e.question_key}`] = e.answer || "";
      }
    });
    setAnswers(grouped);
    answersHydratedRef.current = true;
  }, [moodboardEntries, allSectionKeys, moodboardLoading]);

  /* ═════════════════════════════════════════════════════════════════════════
     SALVAR SOZINHO

     Antes cada grupo tinha um botão Salvar que gravava as perguntas do grupo.
     Trocar de aba sem clicar nele não perdia nada na tela, mas perdia tudo no
     F5, e ninguém percebia até voltar no dia seguinte. Agora a resposta grava
     ao sair do campo, só se mudou, e o cabeçalho mostra "Salvando" e "Salvo".
     ═════════════════════════════════════════════════════════════════════════ */
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const pendentesRef = useRef(0);
  const salvarPergunta = useCallback(async (section: string, key: string) => {
    const atual = answers[section]?.[key] ?? "";
    const chave = `${section}/${key}`;
    if ((persistidoRef.current[chave] ?? "") === atual) return;
    pendentesRef.current += 1;
    setSaveState("saving");
    try {
      await saveAnswer.mutateAsync({ section, question_key: key, answer: atual });
      persistidoRef.current[chave] = atual;
    } catch {
      toast.error("Não consegui salvar essa resposta. Tenta de novo.");
    } finally {
      pendentesRef.current -= 1;
      if (pendentesRef.current === 0) {
        setSaveState("saved");
        window.setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
      }
    }
  }, [answers, saveAnswer]);

  /* ═════════════════════════════════════════════════════════════════════════
     IMPORTAR O BRANDBOOK DE UM (OU DOIS) PDF/IMAGEM E DISTRIBUIR NAS SEÇÕES

     A leitura do arquivo não cai numa aba só: cada pedaço vai pro lugar certo.

       Identidade  → brand_items (cor, fonte) + moodboard-identidade/palavras-chave
                     + moodboard-visual/cores, /estetica
       Linha edit. → linha-editorial/temas
       Persona     → personas (cria UMA persona se ainda não houver)
       Quem você é → moodboard-contexto/diferencial
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

    // 1) Itens de marca (Identidade/Tom): cor, fonte, tom, evitar. Só acrescenta.
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

    // 2) Perguntas guiadas. Só preenche o campo VAZIO, nunca apaga o que a
    //    pessoa escreveu à mão.
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
      persistidoRef.current[`${g.section}/${g.key}`] = v;
      novosAnswers[g.section] = { ...(novosAnswers[g.section] ?? {}), [g.key]: v };
      preenchidos++;
    }
    if (preenchidos > 0) setAnswers(novosAnswers);

    // 3) Público-alvo: cria UMA persona a partir do que o arquivo trouxe, só se
    //    ainda não existir nenhuma. Nunca mexe numa persona que a pessoa criou.
    //    Listas de frases quebram só por ";" e quebra de linha: vírgula
    //    picotaria frases tipo "acha caro, não confia".
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

  const respondida = useCallback((section: string, key: string) =>
    (answers[section]?.[key] ?? "").trim().length > 0, [answers]);

  const contarSecao = useCallback((sectionKey: QuestionSectionKey) => {
    const qs = QUESTION_SECTIONS[sectionKey].questions;
    return { feitas: qs.filter(q => respondida(sectionKey, q.key)).length, total: qs.length };
  }, [respondida]);

  const contarAba = useCallback((aba: Aba) =>
    aba.secoes.reduce((acc, s) => {
      const c = contarSecao(s);
      return { feitas: acc.feitas + c.feitas, total: acc.total + c.total };
    }, { feitas: 0, total: 0 }), [contarSecao]);

  const geral = useMemo(() =>
    ABAS.reduce((acc, a) => {
      const c = contarAba(a);
      return { feitas: acc.feitas + c.feitas, total: acc.total + c.total };
    }, { feitas: 0, total: 0 }), [contarAba]);

  /* "PRÓXIMA EM BRANCO": acha a primeira pergunta vazia, na ordem das abas,
     troca de aba e foca o campo. É o atalho de quem chega com dez minutos e
     quer avançar sem procurar onde parou. */
  const proximaEmBranco = useMemo(() => {
    for (const aba of ABAS) {
      for (const s of aba.secoes) {
        for (const q of QUESTION_SECTIONS[s].questions) {
          if (!respondida(s, q.key)) return { aba: aba.valor, section: s, key: q.key };
        }
      }
    }
    return null;
  }, [respondida]);

  const irParaProxima = () => {
    if (!proximaEmBranco) return;
    setActiveTab(proximaEmBranco.aba);
    requestAnimationFrame(() => {
      const el = document.getElementById(idDaPergunta(proximaEmBranco.section, proximaEmBranco.key));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      // O foco vem depois da rolagem pra ele não puxar a página no meio da animação.
      window.setTimeout(() => el?.focus(), 350);
    });
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

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const renderGuidedSection = (sectionKey: QuestionSectionKey, cor: CorDaAba, showChatPrompt = false) => {
    const config = QUESTION_SECTIONS[sectionKey];
    return (
      <GuidedSection
        key={sectionKey}
        sectionKey={sectionKey}
        title={config.title}
        descricao={INTRO_DA_SECAO[sectionKey]}
        icone={ICONE_DA_SECAO[sectionKey]}
        cor={{ badge: cor.badge, feito: cor.feito }}
        questions={config.questions}
        answers={answers[sectionKey] ?? {}}
        onAnswerChange={(key, value) => handleChange(sectionKey, key, value)}
        onBlur={(key) => void salvarPergunta(sectionKey, key)}
        chatPrompt={showChatPrompt && "chatPrompt" in config ? buildPrompt(sectionKey) : null}
      />
    );
  };

  const completo = geral.total > 0 && geral.feitas === geral.total;

  return (
    <div className="max-w-4xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* ── CABEÇALHO ──
            Uma linha: título (no celular), progresso em número, o estado do
            salvar sozinho e o PDF. A barra "Completude geral" e o card "Sua
            marca em um só lugar" mediam a mesma coisa duas vezes. */}
        {/* flex-wrap + título sem quebra (25/09/2026): no celular o selo de
            progresso e o botão do PDF espremiam o título até ele quebrar no
            meio da palavra ("Brandbo / ok"). Agora, sem espaço, os botões
            descem pra linha de baixo e a palavra fica inteira. */}
        <div className="flex flex-wrap items-start justify-between mb-5 gap-3">
          <div className="flex items-center gap-3 min-w-0 hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
              <BookMarked className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight whitespace-nowrap">
                Brandbook <InfoTooltip text="O Brandbook define a identidade da sua marca. As respostas aqui personalizam todas as sugestões da IA para o seu estilo e público." side="bottom" />
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap justify-end" data-tour="brandbook-hub">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-body font-semibold tabular-nums",
              completo ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-card text-foreground",
            )}>
              {completo && <Check className="h-3.5 w-3.5" />}
              {geral.feitas}/{geral.total} respondidas
            </span>
            <span className={cn(
              "text-[11.5px] font-body text-muted-foreground inline-flex items-center gap-1 min-w-[64px] transition-opacity",
              saveState === "idle" ? "opacity-0" : "opacity-100",
            )} aria-live="polite">
              {saveState === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-600" />}
              {saveState === "saving" ? "Salvando" : "Salvo"}
            </span>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting} className="gap-1.5">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{exporting ? "Exportando..." : "Exportar PDF"}</span>
            </Button>
          </div>
        </div>

        {/* ── IMPORTAR ──
            Era um bloco tracejado de 300px que dominava a entrada da tela, e
            existia de novo dentro da aba Identidade. Virou uma barra, uma vez,
            no topo: quem tem PDF vê; quem vai responder na mão passa reto. */}
        <div id="brandbook-importar" data-tour="brandbook-importar" className="scroll-mt-24 mb-4">
          <BrandbookImport
            alvo="criador"
            campos={CAMPOS_CRIADOR}
            atual={identidadeAtual}
            compacto
            titulo="Tem manual de marca ou moodboard em PDF? O Cria lê e preenche."
            descricao="Até 2 arquivos, PDF ou imagem. Você revisa antes de salvar. Consome 1 geração da cota de IA."
            onSalvar={distribuirDoPdf}
          />
        </div>

        {/* ── PRÓXIMA EM BRANCO ──
            Só aparece enquanto falta alguma. É o convite pra responder: diz o
            que falta, em número, e leva direto no campo. */}
        {proximaEmBranco && (
          <button
            type="button"
            onClick={irParaProxima}
            className="w-full mb-4 rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3 flex items-center gap-3 text-left hover:bg-primary/[0.08] transition-colors group"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground shrink-0">
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-display font-bold text-foreground">
                Continuar de onde parou
              </span>
              <span className="block text-[12px] font-body text-muted-foreground truncate">
                {geral.total - geral.feitas === 1
                  ? "Falta 1 resposta. "
                  : `Faltam ${geral.total - geral.feitas} respostas. `}
                Próxima: {QUESTION_SECTIONS[proximaEmBranco.section].questions.find((q) => q.key === proximaEmBranco.key)?.label}
              </span>
            </span>
          </button>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto -mx-1 px-1 mb-5">
            <TabsList data-tour="brandbook-abas" className="w-max justify-start gap-2 rounded-none bg-transparent p-0 h-auto flex-nowrap">
              {ABAS.map((aba) => {
                const c = contarAba(aba);
                const ok = c.feitas === c.total;
                return (
                  /* Mesma pílula do brandbook do cliente (BrandbookEditor.Aba):
                     borda própria, contador ao lado, ativa em cheio. */
                  <TabsTrigger
                    key={aba.valor}
                    value={aba.valor}
                    className={cn(
                      "group rounded-full border border-border bg-card pl-1.5 pr-3 py-1.5 gap-2 shrink-0 transition-all hover:-translate-y-px hover:shadow-sm",
                      "data-[state=active]:text-white data-[state=active]:shadow-md",
                      aba.cor.ativa,
                    )}
                  >
                    <span className={cn(
                      "grid h-6 w-6 place-items-center rounded-full transition-colors",
                      aba.cor.badge,
                      "group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white",
                    )}>
                      <aba.icone className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="text-[13px] font-display font-semibold whitespace-nowrap">{aba.rotulo}</span>
                    <span className={cn(
                      "text-[10.5px] font-body font-bold tabular-nums rounded-full px-1.5 py-0.5",
                      ok ? aba.cor.feito : "bg-muted text-muted-foreground",
                      "group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white",
                    )}>
                      {c.feitas}/{c.total}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {ABAS.map((aba) => (
            <TabsContent key={aba.valor} value={aba.valor} className="mt-0">
              <motion.div key={aba.valor} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
                <div className={cn("rounded-xl border px-4 py-2.5 flex items-start gap-2.5", aba.cor.faixa)}>
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
                  <p className="text-[13px] font-body leading-relaxed">{aba.intro}</p>
                </div>

                {/* Os pilares vêm ANTES das perguntas (circuito 13): são a
                    decisão concreta; as perguntas ajudam a chegar nelas.
                    O PilaresSection já desenha os próprios cards. */}
                {aba.valor === "linha-editorial" && <PilaresSection />}

                {aba.valor === "persona" && (
                  <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="font-display font-bold text-base text-foreground">Suas personas</h3>
                        <p className="text-[12px] font-body text-muted-foreground mt-0.5">Até {MAX_PERSONAS}. A primeira é a principal.</p>
                      </div>
                      <Button onClick={openNewPersona} disabled={personas.length >= MAX_PERSONAS} size="sm" className="gap-1.5 shrink-0">
                        <Plus className="h-4 w-4" /> Nova
                      </Button>
                    </div>
                    {personas.length === 0 ? (
                      <button
                        type="button"
                        onClick={openNewPersona}
                        className="w-full rounded-xl border border-dashed border-border py-8 text-center hover:border-primary/40 hover:bg-primary/[0.03] transition-colors"
                      >
                        <Users className="h-7 w-7 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm font-body font-semibold text-foreground">Cadastrar a primeira persona</p>
                        <p className="text-xs text-muted-foreground font-body mt-0.5">Nome, dores, desejos e onde ela está.</p>
                      </button>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {personas.map(p => {
                          const firstPain = p.pain_points?.[0];
                          const PersonaIcon = PERSONA_ICON_MAP[p.icon ?? "bot"] ?? Bot;
                          return (
                            <div key={p.id} className="rounded-xl border border-border bg-background p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  <PersonaIcon className="h-5 w-5" strokeWidth={1.5} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-body font-semibold text-foreground truncate">{p.name || "Persona sem nome"}</p>
                                  {firstPain ? (
                                    <p className="text-xs text-muted-foreground font-body mt-0.5 line-clamp-2">
                                      <span className="text-muted-foreground/70">Dor: </span>{firstPain}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground/60 font-body mt-0.5 italic">Sem dores cadastradas</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEditPersona(p.id)}>
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
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {aba.secoes.map((s) => renderGuidedSection(s, aba.cor, s === "linha-editorial" || s === "persona-brand" || s === "tom-de-voz"))}

                {aba.valor === "identidade" && (
                  <BrandValuesSection
                    brandItems={brandItems}
                    tipos={["cor", "fonte"]}
                    activeSection={activeSection}
                    newItemName={newItemName}
                    newItemValue={newItemValue}
                    onActiveSectionChange={setActiveSection}
                    onNewItemNameChange={setNewItemName}
                    onNewItemValueChange={setNewItemValue}
                    onAddBrandItem={addBrandItem}
                    onDeleteBrandItem={handleDeleteBrandItem}
                  />
                )}

                {aba.valor === "tom-de-voz" && (
                  <BrandValuesSection
                    brandItems={brandItems}
                    tipos={["tom", "expressao", "evitar"]}
                    activeSection={activeSection}
                    newItemName={newItemName}
                    newItemValue={newItemValue}
                    onActiveSectionChange={setActiveSection}
                    onNewItemNameChange={setNewItemName}
                    onNewItemValueChange={setNewItemValue}
                    onAddBrandItem={addBrandItem}
                    onDeleteBrandItem={handleDeleteBrandItem}
                  />
                )}
              </motion.div>
            </TabsContent>
          ))}
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

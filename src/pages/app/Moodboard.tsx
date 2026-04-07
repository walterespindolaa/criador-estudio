import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/CopyButton";
import { Heart, Palette, Compass, Sparkles, Save, MessageSquareText } from "lucide-react";

interface MoodboardEntry {
  id: string;
  section: string;
  question_key: string;
  answer: string;
}

const SECTIONS = [
  {
    key: "identidade",
    title: "Identidade e Sensações",
    icon: Heart,
    color: "text-primary",
    bg: "bg-primary/5",
    questions: [
      { key: "sentimento", label: "Que sentimento você quer que as pessoas tenham ao ver seu conteúdo?" },
      { key: "palavras", label: "3 palavras que descrevem a energia da sua marca pessoal:" },
      { key: "musica", label: "Se sua marca fosse uma música, qual seria? Por quê?" },
      { key: "memoria", label: "Qual memória ou momento da sua vida representa o que você quer transmitir?" },
    ],
  },
  {
    key: "visual",
    title: "Visual e Estilo",
    icon: Palette,
    color: "text-secondary",
    bg: "bg-secondary/5",
    questions: [
      { key: "cores", label: "Quais cores representam você? (pense em 3 a 5 cores)" },
      { key: "estetica", label: "Descreva a estética dos seus conteúdos ideais (minimalista, vibrante, aconchegante, etc.)" },
      { key: "fonte", label: "Se você tivesse que escolher um estilo tipográfico, qual seria? (serifada, moderna, manuscrita)" },
      { key: "ambiente", label: "Descreva o cenário/ambiente ideal para gravar seus conteúdos:" },
    ],
  },
  {
    key: "contexto",
    title: "Contexto e Propósito",
    icon: Compass,
    color: "text-accent-foreground",
    bg: "bg-accent/30",
    questions: [
      { key: "porque", label: "Por que você cria conteúdo? Qual é a sua missão?" },
      { key: "diferencial", label: "O que te diferencia de outros criadores no seu nicho?" },
      { key: "impacto", label: "Qual impacto você quer causar na vida de quem te segue?" },
      { key: "legado", label: "Daqui a 5 anos, o que você quer que digam sobre seu trabalho?" },
    ],
  },
  {
    key: "inspiracoes",
    title: "Inspirações Pessoais",
    icon: Sparkles,
    color: "text-primary",
    bg: "bg-primary/5",
    questions: [
      { key: "criadores", label: "Quais criadores te inspiram? O que você admira neles?" },
      { key: "marcas", label: "Quais marcas (de qualquer segmento) você acha bonitas e autênticas?" },
      { key: "conteudo_ref", label: "Descreva um conteúdo que você viu e pensou 'quero fazer algo assim':" },
      { key: "fora_digital", label: "O que fora do digital te inspira? (livros, filmes, viagens, arte, natureza)" },
    ],
  },
];

const CHAT_PROMPT = `Olá! Preciso da sua ajuda para refinar minha identidade de marca como criador(a) de conteúdo.

Aqui estão minhas respostas do moodboard:

[Cole suas respostas abaixo]

Com base nisso, me ajude a:
1. Definir 3 palavras-chave que resumem minha marca
2. Sugerir uma paleta de cores que combina com minha essência
3. Criar uma frase de posicionamento (tipo um slogan pessoal)
4. Sugerir referências visuais e de conteúdo alinhadas ao meu estilo

Responda em português brasileiro, de forma prática e inspiradora.`;

const Moodboard = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<MoodboardEntry[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("moodboard_entries" as any)
      .select("*")
      .eq("user_id", user.id);
    const items = (data as any[] || []) as MoodboardEntry[];
    setEntries(items);
    const map: Record<string, string> = {};
    items.forEach(e => { map[`${e.section}.${e.question_key}`] = e.answer; });
    setAnswers(map);
  }, [user]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const updateAnswer = (section: string, questionKey: string, value: string) => {
    setAnswers(prev => ({ ...prev, [`${section}.${questionKey}`]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const rows: any[] = [];
    SECTIONS.forEach(section => {
      section.questions.forEach(q => {
        const answer = answers[`${section.key}.${q.key}`] || "";
        rows.push({
          user_id: user.id,
          section: section.key,
          question_key: q.key,
          answer,
        });
      });
    });

    // Upsert by deleting and re-inserting (simpler than individual upserts with `as any`)
    await supabase.from("moodboard_entries" as any).delete().eq("user_id", user.id);
    const { error } = await supabase.from("moodboard_entries" as any).insert(rows);

    if (error) {
      toast.error("Erro ao salvar moodboard.");
    } else {
      toast.success("Moodboard salvo!");
    }
    setSaving(false);
    fetchEntries();
  };

  const filledCount = Object.values(answers).filter(v => v.trim().length > 0).length;
  const totalQuestions = SECTIONS.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <div className="max-w-4xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Moodboard</h1>
            <p className="text-muted-foreground font-body mt-1">
              Defina a essência da sua marca. Responda com calma — não existe resposta errada.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-body">
              {filledCount}/{totalQuestions} preenchidas
            </span>
            <Button variant="hero" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1.5" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.key} className="bg-card rounded-2xl shadow-warm border border-border overflow-hidden">
              <div className={`${section.bg} px-6 py-4 flex items-center gap-3 border-b border-border`}>
                <section.icon className={`h-5 w-5 ${section.color}`} />
                <h2 className="font-display font-semibold text-foreground">{section.title}</h2>
              </div>
              <div className="p-6 space-y-5">
                {section.questions.map((q) => {
                  const key = `${section.key}.${q.key}`;
                  return (
                    <div key={q.key} className="space-y-2">
                      <label className="font-body text-sm font-medium text-foreground">{q.label}</label>
                      <Textarea
                        placeholder="Escreva aqui..."
                        value={answers[key] || ""}
                        onChange={(e) => updateAnswer(section.key, q.key, e.target.value)}
                        className="rounded-xl min-h-[80px] text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Chat prompt block */}
          <div className="bg-card rounded-2xl shadow-warm border border-border overflow-hidden">
            <div className="bg-primary/5 px-6 py-4 flex items-center gap-3 border-b border-border">
              <MessageSquareText className="h-5 w-5 text-primary" />
              <h2 className="font-display font-semibold text-foreground">Perguntar ao Chat</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="font-body text-sm text-muted-foreground">
                Copie o prompt abaixo, cole suas respostas do moodboard e envie para o ChatGPT ou Claude para refinar sua identidade de marca.
              </p>
              <div className="bg-muted/50 rounded-xl p-4 relative">
                <pre className="text-xs font-body text-foreground whitespace-pre-wrap leading-relaxed">{CHAT_PROMPT}</pre>
                <div className="mt-3">
                  <CopyButton text={CHAT_PROMPT} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Moodboard;

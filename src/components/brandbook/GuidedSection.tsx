import { motion } from "framer-motion";
import { Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/shared/CopyButton";

type Question = {
  key: string;
  label: string;
  placeholder: string;
};

type Props = {
  sectionKey: string;
  title: string;
  questions: ReadonlyArray<Question>;
  answers: Record<string, string>;
  progress: number;
  saving: boolean;
  onAnswerChange: (questionKey: string, value: string) => void;
  onSave: () => void;
  chatPrompt?: string | null;
};

export function GuidedSection({
  sectionKey,
  title,
  questions,
  answers,
  progress,
  saving,
  onAnswerChange,
  onSave,
  chatPrompt,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
      key={sectionKey}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1">
          <h3 className="text-base font-display font-semibold text-foreground">{title}</h3>
        </div>
        <div className="text-right">
          <span className="text-xs text-muted-foreground font-body">{progress}%</span>
          <Progress value={progress} className="w-20 h-1.5 mt-1" />
        </div>
      </div>

      {questions.map((q, i) => (
        <motion.div
          key={q.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-body font-semibold text-foreground">{q.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={answers[q.key] || ""}
                onChange={(e) => onAnswerChange(q.key, e.target.value)}
                placeholder={q.placeholder}
                className="min-h-[80px] resize-y font-body text-sm border-border rounded-xl"
              />
            </CardContent>
          </Card>
        </motion.div>
      ))}

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {chatPrompt && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Seu Guia Editorial Personalizado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground font-body">
              Com base em tudo que você respondeu, esse prompt vai gerar um guia completo para nortear sua criação de conteúdo. Copie, cole no ChatGPT ou Claude e receba um plano prático feito para você.
            </p>
            <div className="bg-card rounded-xl p-4 border border-border max-h-48 overflow-y-auto">
              <pre className="text-xs font-body text-foreground whitespace-pre-wrap">{chatPrompt}</pre>
            </div>
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 mb-3">
              <p className="text-xs font-body text-amber-700 leading-relaxed">
                💡 <strong>Lembre-se:</strong> o guia gerado é um ponto de partida para destravar suas ideias e dar o primeiro passo. A sua essência, experiências e conhecimento são insubstituíveis — use o guia como bússola, não como roteiro fechado.
              </p>
            </div>
            <CopyButton text={chatPrompt} />
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/shared/CopyButton";
import { VoiceInput } from "@/components/shared/VoiceInput";

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
  // Resposta ABERTA em janela grande. A Gabriela preenche respostas longas
  // (parágrafos inteiros vindos da estratégia) e o textarea de 80px vira um
  // olho mágico: dá pra digitar, não dá pra LER. O expandir abre a resposta
  // numa janela de leitura/edição confortável, estilo card do Trello.
  const [expandida, setExpandida] = useState<Question | null>(null);

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
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-body font-semibold text-foreground">{q.label}</CardTitle>
                {(answers[q.key] || "").trim() && (
                  <button
                    type="button"
                    onClick={() => setExpandida(q)}
                    title="Ver a resposta inteira"
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-body text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                  >
                    <Maximize2 className="h-3 w-3" /> expandir
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Textarea
                  value={answers[q.key] || ""}
                  onChange={(e) => onAnswerChange(q.key, e.target.value)}
                  placeholder={q.placeholder}
                  className="min-h-[80px] resize-y font-body text-sm border-border rounded-xl pr-12"
                />
                <VoiceInput
                  onTranscript={(txt) => onAnswerChange(q.key, ((answers[q.key] || "").trim() ? answers[q.key] + " " : "") + txt)}
                  className="absolute bottom-2 right-2"
                />
              </div>
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

      {/* Janela de leitura/edição da resposta. Edição aqui é a MESMA resposta
          (mesmo onAnswerChange): fechar não perde nada, e o Salvar da seção
          continua sendo quem persiste. */}
      <Dialog open={!!expandida} onOpenChange={(o) => !o && setExpandida(null)}>
        <DialogContent className="sm:max-w-2xl">
          {expandida && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-base pr-6">{expandida.label}</DialogTitle>
              </DialogHeader>
              <Textarea
                value={answers[expandida.key] || ""}
                onChange={(e) => onAnswerChange(expandida.key, e.target.value)}
                placeholder={expandida.placeholder}
                className="min-h-[50vh] resize-y font-body text-sm border-border rounded-xl leading-relaxed"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-body text-muted-foreground">
                  Pode editar aqui mesmo. Use o Salvar da seção pra gravar.
                </p>
                <Button variant="outline" size="sm" onClick={() => setExpandida(null)}>Fechar</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
                💡 <strong>Lembre-se:</strong> o guia gerado é um ponto de partida para destravar suas ideias e dar o primeiro passo. A sua essência, experiências e conhecimento são insubstituíveis, use o guia como bússola, não como roteiro fechado.
              </p>
            </div>
            <CopyButton text={chatPrompt} />
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

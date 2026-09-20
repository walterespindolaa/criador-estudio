import { useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from "react";
import { ChevronDown, Sparkles, type LucideIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/shared/CopyButton";
import { VoiceInput } from "@/components/shared/VoiceInput";
import { cn } from "@/lib/utils";
import { idDaPergunta } from "@/lib/brandbook-perguntas";

type Question = {
  key: string;
  label: string;
  placeholder: string;
};

type Props = {
  sectionKey: string;
  title: string;
  /** Uma frase dizendo pra que serve este grupo. É o que transforma o
   *  formulário em conversa: a pessoa entende por que está respondendo. */
  descricao?: string;
  questions: ReadonlyArray<Question>;
  answers: Record<string, string>;
  onAnswerChange: (questionKey: string, value: string) => void;
  /** Chamado quando a pessoa sai do campo. É o gatilho do salvar sozinho. */
  onBlur: (questionKey: string) => void;
  chatPrompt?: string | null;
  /** Ícone e cor do grupo. A cor vem da aba: cada aba tem a sua, e o card
   *  herda, pra pessoa saber onde está sem ler o nome. */
  icone?: LucideIcon;
  cor?: { badge: string; feito: string };
};

/* O campo cresce com o texto. Antes havia um "abrir" que jogava a resposta
   num popup: a pessoa saía do lugar onde estava pra ler o que já via, e voltava.
   Se o campo tem o tamanho do texto, não existe nada pra abrir. */
function CampoQueCresce(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
  }, [props.value]);
  return <Textarea ref={ref} {...props} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   UM GRUPO DE PERGUNTAS (Walter, 20/09/2026: "essa parte de visualização do
   brandbook é muito esquisita e confusa")

   Antes cada pergunta era um Card inteiro com cabeçalho, e cada grupo tinha
   barra de progresso própria e um botão Salvar no fim. Seis grupos na mesma
   aba viravam seis barras, seis botões e trinta cards: parecia um sistema, não
   um caderno.

   Agora o grupo é UM card, no mesmo desenho do brandbook do cliente na visão
   da social mídia (título com ícone, contador no canto, campo embaixo de
   campo). O Salvar sumiu: a resposta grava quando a pessoa sai do campo, igual
   à descrição do pilar. Campo vazio tem borda tracejada, que é o único sinal
   que a pessoa precisa pra achar o que falta sem ler tudo de novo.
   ═══════════════════════════════════════════════════════════════════════════ */
export function GuidedSection({
  sectionKey,
  title,
  descricao,
  questions,
  answers,
  onAnswerChange,
  onBlur,
  chatPrompt,
  icone: Icone,
  cor,
}: Props) {
  const [promptAberto, setPromptAberto] = useState(false);

  const feitas = questions.filter((q) => (answers[q.key] ?? "").trim()).length;
  const completo = feitas === questions.length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          {Icone && (
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", cor?.badge ?? "bg-primary/10 text-primary")}>
              <Icone className="h-4 w-4" strokeWidth={1.75} />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-display font-bold text-base text-foreground">{title}</h3>
            {descricao && (
              <p className="text-[12px] font-body text-muted-foreground mt-0.5 leading-snug">{descricao}</p>
            )}
          </div>
        </div>
        <span className={cn(
          "shrink-0 text-[11px] font-body font-bold tabular-nums rounded-full px-2 py-0.5",
          completo ? (cor?.feito ?? "bg-emerald-100 text-emerald-700") : "bg-muted text-muted-foreground",
        )}>
          {feitas}/{questions.length}
        </span>
      </div>

      <div className="space-y-5">
        {questions.map((q) => {
          const valor = answers[q.key] ?? "";
          const vazia = !valor.trim();
          return (
            <div key={q.key}>
              <label
                htmlFor={idDaPergunta(sectionKey, q.key)}
                className="block text-[13px] font-body font-semibold text-foreground leading-snug mb-1.5"
              >
                {q.label}
              </label>
              <div className="relative">
                <CampoQueCresce
                  id={idDaPergunta(sectionKey, q.key)}
                  value={valor}
                  onChange={(e) => onAnswerChange(q.key, e.target.value)}
                  onBlur={() => onBlur(q.key)}
                  placeholder={q.placeholder}
                  className={cn(
                    "min-h-[72px] resize-none overflow-hidden font-body text-sm rounded-xl pr-12 leading-relaxed",
                    vazia ? "border-dashed border-border" : "border-border",
                  )}
                />
                <VoiceInput
                  onTranscript={(txt) => onAnswerChange(q.key, (valor.trim() ? valor + " " : "") + txt)}
                  className="absolute bottom-2 right-2"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* O prompt pra IA externa ficava aberto, com pré de 200px, embaixo de
          cada grupo. Virou uma linha que abre: quem quer, acha; quem está
          respondendo, não tropeça nele. */}
      {chatPrompt && (
        <div className="mt-5 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => setPromptAberto((v) => !v)}
            className="w-full flex items-center gap-2 text-left text-[12.5px] font-body text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="flex-1">Quer um guia a partir dessas respostas? Copie o prompt e cole no ChatGPT ou Claude.</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", promptAberto && "rotate-180")} />
          </button>
          {promptAberto && (
            <div className="mt-3 space-y-3">
              <div className="bg-muted/30 rounded-xl p-4 border border-border max-h-48 overflow-y-auto">
                <pre className="text-xs font-body text-foreground whitespace-pre-wrap">{chatPrompt}</pre>
              </div>
              <p className="text-[11.5px] font-body text-muted-foreground leading-relaxed">
                O guia é ponto de partida, não roteiro fechado. A sua essência e a sua experiência são o que a IA não tem.
              </p>
              <CopyButton text={chatPrompt} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

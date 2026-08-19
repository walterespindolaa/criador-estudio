import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, ChevronDown, Loader2, RotateCcw } from "lucide-react";

export const STAGE_ORDER = ["tema", "conteudo", "midia", "legenda"] as const;
export type Stage = (typeof STAGE_ORDER)[number];

const STAGE_LABEL: Record<Stage, string> = { tema: "Tema", conteudo: "Conteúdo", midia: "Mídia", legenda: "Legenda" };
const STAGE_HINT: Record<Stage, string> = {
  tema: "A ideia central deste post",
  conteudo: "O roteiro ou texto do post",
  midia: "A imagem ou vídeo do post",
  legenda: "O texto que acompanha a publicação",
};

type StageStatus = "pendente" | "ajuste_solicitado" | "aprovado";

export type EtapasPost = {
  title: string;
  hook: string | null;
  script: string | null;
  caption: string | null;
  approval_stages: Record<string, string> | null;
  approval_status: "pendente" | "ajuste_solicitado" | "aprovado";
};

function stageValue(post: EtapasPost, stage: Stage): { text: string; box: boolean } {
  switch (stage) {
    case "tema":
      return { text: post.title || "Sem tema definido.", box: false };
    case "conteudo":
      return { text: post.script || post.hook || "Sem conteúdo definido.", box: true };
    case "midia":
      return { text: "Confira a imagem ou o vídeo na prévia do post nesta página.", box: false };
    case "legenda":
      return { text: post.caption || "Sem legenda definida.", box: true };
  }
}

export function EtapasChecklist({ post, busy, onApproveStage, onAdjustStage }: {
  post: EtapasPost;
  busy: boolean;
  onApproveStage: (stage: Stage, comment?: string) => void;
  onAdjustStage: (stage: Stage, comment: string) => void;
}) {
  const status = (s: Stage): StageStatus => {
    const raw = post.approval_stages?.[s];
    return raw === "aprovado" || raw === "ajuste_solicitado" ? raw : "pendente";
  };

  const approvedCount = STAGE_ORDER.filter((s) => status(s) === "aprovado").length;
  const allApproved = approvedCount === STAGE_ORDER.length || post.approval_status === "aprovado";
  const firstPending = STAGE_ORDER.find((s) => status(s) !== "aprovado") ?? null;

  const [open, setOpen] = useState<Stage | null>(firstPending);
  const [adjustFor, setAdjustFor] = useState<Stage | null>(null);
  const [comment, setComment] = useState("");
  // Mesma ideia da aprovação rápida: elogiar não pode obrigar a pedir ajuste.
  const [okFor, setOkFor] = useState<Stage | null>(null);
  const [nota, setNota] = useState("");
  const LIMITE_NOTA = 140;
  const prevFirst = useRef<Stage | null>(firstPending);

  // Quando uma etapa é aprovada (ou ajustada), avança automaticamente pra próxima pendente.
  useEffect(() => {
    if (prevFirst.current !== firstPending) {
      prevFirst.current = firstPending;
      setOpen(firstPending);
      setAdjustFor(null);
      setComment("");
    }
  }, [firstPending]);

  const toggle = (s: Stage) => {
    setOpen((cur) => (cur === s ? null : s));
    setAdjustFor(null);
    setComment("");
  };

  const openAdjust = (s: Stage) => { setAdjustFor(s); setComment(""); };
  const sendAdjust = (s: Stage) => { onAdjustStage(s, comment.trim()); setAdjustFor(null); setComment(""); };

  return (
    <div>
      <h3 className="text-lg font-display font-extrabold text-foreground">Aprovação por etapas</h3>
      <p className="text-[13px] text-muted-foreground font-body mt-0.5">Revise cada etapa abaixo. Aprove ou peça ajuste, uma por uma.</p>

      <div className="flex items-center gap-3 mt-3.5 mb-4">
        <div className="flex-1 h-1.5 rounded-full bg-primary/10 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(approvedCount / STAGE_ORDER.length) * 100}%` }} />
        </div>
        <span className="text-xs font-body font-bold text-primary shrink-0">{approvedCount} de {STAGE_ORDER.length} etapas aprovadas</span>
      </div>

      {allApproved && (
        <div className="text-center bg-green-50 border border-green-100 rounded-2xl px-4 py-6 mb-4">
          <div className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-3">
            <Check className="h-7 w-7" strokeWidth={3} />
          </div>
          <p className="font-display font-extrabold text-green-800 text-base">Tudo aprovado, obrigado!</p>
          <p className="text-[13px] font-body text-green-700 mt-1">Quem cuida do seu conteúdo já foi avisado e vai seguir com a publicação.</p>
        </div>
      )}

      <ul className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
        {STAGE_ORDER.map((s, i) => {
          const st = status(s);
          const isOpen = open === s;
          const isAdjusting = adjustFor === s;
          const value = stageValue(post, s);
          return (
            <li key={s} className={isOpen ? "bg-primary/[0.03]" : "bg-card"}>
              <button
                type="button"
                onClick={() => toggle(s)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[56px] text-left transition-colors hover:bg-muted/40"
              >
                {st === "aprovado" ? (
                  <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0"><Check className="h-[18px] w-[18px]" strokeWidth={3} /></span>
                ) : st === "ajuste_solicitado" ? (
                  <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><RotateCcw className="h-4 w-4" /></span>
                ) : (
                  <span className={`w-8 h-8 rounded-full border-[1.5px] flex items-center justify-center text-[13px] font-body font-extrabold shrink-0 ${isOpen ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{i + 1}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-display font-bold text-foreground leading-tight">{STAGE_LABEL[s]}</span>
                  <span className="block text-[11.5px] font-body text-muted-foreground truncate">{STAGE_HINT[s]}</span>
                </span>
                <span className={`text-[11px] font-body font-bold px-2.5 py-1 rounded-full shrink-0 ${st === "aprovado" ? "bg-green-100 text-green-700" : st === "ajuste_solicitado" ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"}`}>
                  {st === "aprovado" ? "Aprovada" : st === "ajuste_solicitado" ? "Em ajuste" : "Pendente"}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="px-3.5 pb-4 pt-0.5">
                  <p className={`text-sm font-body leading-relaxed whitespace-pre-wrap ${value.box ? "bg-muted/50 rounded-xl p-3" : "text-foreground/90"}`}>{value.text}</p>

                  {st === "aprovado" ? (
                    <div className="mt-3.5 flex items-center gap-2 text-sm font-body font-bold text-green-700 bg-green-50 rounded-xl px-3.5 py-3">
                      <Check className="h-4 w-4 shrink-0" /> Etapa aprovada
                    </div>
                  ) : isAdjusting ? (
                    <div className="mt-3.5 space-y-2.5">
                      <p className="text-xs font-body text-muted-foreground">Conte pra gente o que mudar. Seu comentário vai direto pra quem cuida desta etapa.</p>
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={`Escreva aqui o que precisa mudar em ${STAGE_LABEL[s]}...`}
                        className="rounded-xl bg-card"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2.5">
                        <Button className="flex-1 h-12 rounded-xl font-bold" disabled={busy || !comment.trim()} onClick={() => sendAdjust(s)}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar ajuste"}
                        </Button>
                        <Button variant="ghost" className="h-12 rounded-xl" onClick={() => { setAdjustFor(null); setComment(""); }} disabled={busy}>Cancelar</Button>
                      </div>
                    </div>
                  ) : okFor === s ? (
                    <div className="mt-3.5 space-y-2.5">
                      <p className="text-xs font-body text-muted-foreground">Quer deixar um recado sobre {STAGE_LABEL[s].toLowerCase()}? É opcional.</p>
                      <Textarea
                        value={nota}
                        onChange={(e) => setNota(e.target.value.slice(0, LIMITE_NOTA))}
                        maxLength={LIMITE_NOTA}
                        placeholder="Ex.: ficou exatamente como eu imaginei"
                        className="rounded-xl bg-card"
                        rows={2}
                        autoFocus
                      />
                      <p className="text-[11px] font-body text-muted-foreground text-right">{nota.length}/{LIMITE_NOTA}</p>
                      <div className="flex gap-2.5">
                        <Button className="flex-1 h-12 rounded-xl font-bold" disabled={busy} onClick={() => { onApproveStage(s, nota.trim() || undefined); setOkFor(null); setNota(""); }}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" /> Confirmar</>}
                        </Button>
                        <Button variant="ghost" className="h-12 rounded-xl" onClick={() => { setOkFor(null); setNota(""); }} disabled={busy}>Voltar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3.5 flex flex-col sm:flex-row gap-2.5">
                      <Button className="flex-1 h-12 rounded-xl text-[15px] font-bold shadow-lg shadow-primary/20" onClick={() => { setOkFor(s); setNota(""); }} disabled={busy}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" /> Aprovar esta etapa</>}
                      </Button>
                      <Button variant="secondary" className="h-12 rounded-xl px-4" onClick={() => openAdjust(s)} disabled={busy}>
                        <RotateCcw className="h-4 w-4 mr-1.5" /> Pedir ajuste
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryPost, StorySlot } from "@/hooks/useStoryPlan";

/* ═══════════════════════════════════════════════════════════════════════════
   ANDAMENTO DO STORY NO CARD DA SEMANA (28/10/2026, mockup aprovado)

   Plano → Gravar (só story falado) → Mídia → Publicar, com o próximo passo
   num botão. O post por trás do story é que anda pelo Criando, Prompter e
   publicação; aqui só lemos o estado dele.
   ═══════════════════════════════════════════════════════════════════════════ */

export type AcaoStory = "gravar" | "midia" | "conferir" | "postei" | "tentar" | "desfazer";

/* Tipo do story: regra única em src/lib/storyRoteiro.ts (28/10/2026). */
import { storyFalado, storyComFigurinha } from "@/lib/storyRoteiro";
export { storyFalado, storyComFigurinha };

type Estado = {
  selo: string; seloCls: string;
  etapas: Array<{ nome: string; feito: boolean; atual: boolean; pula: boolean }>;
  acao?: { tipo: AcaoStory; txt: string };
  acao2?: { tipo: AcaoStory; txt: string };
  nota?: string;
  numeros?: Array<{ v: number; r: string }>;
};

export function estadoDoStory(slot: StorySlot, post: StoryPost | undefined, podePublicar: boolean | undefined): Estado | null {
  if (!post || post.deleted_at) return null;
  const falado = storyFalado(slot.format);
  const celular = post.ig_opcoes?.pelo_celular === true || post.ig_opcoes?.musica_celular === true;
  const temMidia = post.midias > 0;
  const saiu = post.status === "publicado" || post.publish_status === "publicado" || slot.status === "feito";
  const etapas = [
    { nome: "Plano", feito: true, atual: false, pula: false },
    { nome: "Gravar", feito: temMidia || saiu, atual: falado && !temMidia && !saiu, pula: !falado },
    { nome: "Mídia", feito: temMidia || saiu, atual: !falado && !temMidia && !saiu, pula: false },
    { nome: "Publicar", feito: saiu, atual: temMidia && !saiu, pula: false },
  ];
  const hora = slot.slot_time ? slot.slot_time.slice(0, 5) : "";

  if (saiu) {
    const n = post.numeros ?? {};
    const numeros = [["views", "visualiz."], ["replies", "respostas"], ["follows", "seguidores"]]
      .filter(([k]) => typeof n[k] === "number").map(([k, r]) => ({ v: n[k], r }));
    return { selo: "Saiu", seloCls: "bg-green-100 text-green-800", etapas, numeros };
  }
  if (post.publish_status === "publicando") return { selo: "Publicando", seloCls: "bg-violet-100 text-violet-800", etapas };
  if (post.publish_status === "erro") {
    return { selo: "Não saiu", seloCls: "bg-red-100 text-red-800", etapas, nota: post.publish_error ?? undefined,
      acao: { tipo: "tentar", txt: "Tentar de novo" }, acao2: { tipo: "postei", txt: "Já postei" } };
  }
  if (post.publish_status === "na_fila" && post.auto_publish) {
    return { selo: `Sai ${hora || "no horário"}`, seloCls: "bg-sky-100 text-sky-800", etapas, acao2: { tipo: "desfazer", txt: "Desfazer" } };
  }
  if (celular) {
    return {
      selo: "Pelo celular", seloCls: "bg-amber-100 text-amber-900", etapas,
      nota: "Figurinha ou música: poste pelo app. O lembrete chega no horário.",
      acao: temMidia ? { tipo: "postei", txt: "Já postei" } : { tipo: falado ? "gravar" : "midia", txt: falado ? "Gravar no Prompter" : "Subir mídia" },
      acao2: temMidia ? undefined : { tipo: "postei", txt: "Já postei" },
    };
  }
  if (!temMidia) {
    return falado
      ? { selo: "Pra gravar", seloCls: "bg-orange-100 text-orange-900", etapas, acao: { tipo: "gravar", txt: "Gravar no Prompter" }, acao2: { tipo: "midia", txt: "Subir mídia" } }
      : { selo: "Falta a mídia", seloCls: "bg-muted text-muted-foreground", etapas, acao: { tipo: "midia", txt: "Subir mídia" } };
  }
  if (podePublicar === false) {
    return { selo: "Pronto", seloCls: "bg-sky-100 text-sky-800", etapas,
      nota: "Instagram sem permissão de publicar pelo Cria: reconecte em Insights ou poste pelo app.",
      acao: { tipo: "postei", txt: "Já postei" } };
  }
  return { selo: "Pronto pra sair", seloCls: "bg-sky-100 text-sky-800", etapas,
    acao: { tipo: "conferir", txt: hora ? `Agendar ${hora}` : "Agendar" }, acao2: { tipo: "postei", txt: "Já postei" } };
}

export function StoryAndamento({ estado, ocupado, onAcao }: { estado: Estado; ocupado?: boolean; onAcao: (a: AcaoStory) => void }) {
  return (
    <div className="mt-1.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1 flex-wrap">
        <span className={cn("text-[9.5px] font-body font-bold rounded-full px-1.5 py-0.5", estado.seloCls)}>{estado.selo}</span>
      </div>
      <div className="flex gap-0.5" aria-label="Etapas do story">
        {estado.etapas.map((e) => (
          <span key={e.nome} title={e.nome}
            className={cn("flex-1 text-center text-[8.5px] font-body font-semibold rounded py-0.5 truncate",
              e.pula ? "bg-muted/40 text-muted-foreground/40 line-through" : e.feito ? "bg-foreground text-background" : e.atual ? "bg-orange-100 text-orange-900" : "bg-muted text-muted-foreground")}>
            {e.nome}
          </span>
        ))}
      </div>
      {estado.nota && <p className="text-[10px] font-body text-muted-foreground leading-snug">{estado.nota}</p>}
      {estado.numeros && estado.numeros.length > 0 && (
        <p className="text-[10px] font-body text-foreground">{estado.numeros.map((n) => `${n.v.toLocaleString("pt-BR")} ${n.r}`).join(" · ")}</p>
      )}
      {(estado.acao || estado.acao2) && (
        <div className="flex flex-wrap gap-1">
          {estado.acao && (
            <button type="button" disabled={ocupado} onClick={() => onAcao(estado.acao!.tipo)}
              className="h-7 px-2 rounded-full bg-[#EA4918] text-white text-[10.5px] font-body font-bold hover:bg-[#d23f12] disabled:opacity-60">
              {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : estado.acao.txt}
            </button>
          )}
          {estado.acao2 && (
            <button type="button" disabled={ocupado} onClick={() => onAcao(estado.acao2!.tipo)}
              className="h-7 px-2 rounded-full border border-border bg-background text-[10.5px] font-body font-semibold hover:bg-muted">
              {estado.acao2.txt}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import { Check, Flame, Plus } from "lucide-react";
import type { Sequencia } from "@/lib/sequencia";
import { diferencaDias, somarDiasISO } from "@/lib/sequencia";
import { cn } from "@/lib/utils";
import { CARTAO_INICIO } from "@/components/dashboard/InicioBlocos";

/* ═══════════════════════════════════════════════════════════════════════════
   SEQUÊNCIA NO INÍCIO (Walter, 27/11/2026, opção A do mockup de retorno:
   https://claude.ai/artifact/3oBSu2r55fNTTR1HWrawk5)

   Um motivo pra abrir o app toda semana: ver a sequência crescer. Fica logo
   abaixo do topo, só pro criador na própria conta. Mostra as semanas seguidas
   batendo a meta, as últimas 8 em bolinhas (a atual tracejada), a barra da
   semana, a maior sequência e uma dica que muda com o que falta.
   Sem meta ou sem nenhuma semana batida ainda: convite pro 1º post da semana.
   ═══════════════════════════════════════════════════════════════════════════ */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export type ProximoPost = { dia: string; titulo: string };

function quandoSai(dia: string, hoje: string): string {
  const d = diferencaDias(hoje, dia);
  if (d <= 0) return "de hoje";
  if (d === 1) return "de amanhã";
  const [y, m, dd] = dia.split("-").map(Number);
  return `de ${DIAS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]}`;
}

export function SequenciaSemanas({ seq, temMeta, hoje, proximo, onNovoPost, onDefinirMeta }: {
  seq: Sequencia;
  temMeta: boolean;
  hoje: string;
  proximo?: ProximoPost | null;
  onNovoPost: () => void;
  onDefinirMeta: () => void;
}) {
  const vazio = !temMeta || (seq.atual === 0 && seq.maior === 0);
  const pct = Math.min(100, Math.round((seq.feitosSemana / seq.meta) * 100));
  const avisoProximo = proximo ? ` Seu post ${quandoSai(proximo.dia, hoje)} já está marcado.` : "";

  if (vazio) {
    return (
      <section className={cn(CARTAO_INICIO, "p-5 gap-3")} data-tour="dash-sequencia">
        <div className="flex items-center gap-3">
          <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] border-2 border-dashed border-[#EA4918] text-[#EA4918]">
            <Flame className="h-6 w-6" strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <p className="font-display font-extrabold text-[22px] leading-tight text-foreground">Comece sua sequência</p>
            <p className="text-[13px] font-body text-muted-foreground">
              {temMeta
                ? `Publique ${plural(seq.meta, "post", "posts")} até domingo e a 1ª semana entra na conta.`
                : "Escolha quantos posts quer publicar por semana e a gente conta as semanas seguidas."}
            </p>
          </div>
        </div>
        {temMeta && seq.feitosSemana > 0 && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <i className="block h-full rounded-full bg-[#EA4918]" style={{ width: `${pct}%` }} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onNovoPost}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D4A2B] bg-[#2D4A2B] px-4 h-10 text-[13px] font-body font-extrabold text-white">
            <Plus className="h-4 w-4" /> Publicar o 1º post da semana
          </button>
          {!temMeta && (
            <button type="button" onClick={onDefinirMeta}
              className="inline-flex items-center rounded-full border-2 border-foreground bg-card px-4 h-10 text-[13px] font-body font-extrabold">Definir minha meta</button>
          )}
        </div>
        {temMeta && avisoProximo && <p className="text-[12.5px] font-body text-muted-foreground">{avisoProximo.trim()}</p>}
      </section>
    );
  }

  const dica = seq.faltamSemana === 0
    ? <><b>Meta batida, sequência garantida.</b> Tudo que sair agora é bônus.</>
    : <><b>Falta{seq.faltamSemana > 1 ? "m" : ""} {plural(seq.faltamSemana, "post", "posts")} até domingo</b> pra chegar a {plural(seq.atual + 1, "semana", "semanas")}.{avisoProximo}</>;

  return (
    <section className={cn(CARTAO_INICIO, "p-5 gap-3")} data-tour="dash-sequencia">
      <div className="flex items-center gap-3">
        <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] bg-[#EA4918] text-white">
          <Flame className="h-6 w-6" strokeWidth={2.4} />
        </span>
        <div className="min-w-0">
          <p className="font-display font-extrabold text-[30px] sm:text-[34px] leading-none text-foreground tabular-nums">
            {plural(seq.atual, "semana", "semanas")}
          </p>
          <p className="text-[13px] font-body text-muted-foreground">
            {seq.atual === 1 ? "batendo" : "seguidas batendo"} a sua meta de {plural(seq.meta, "post", "posts")}
          </p>
        </div>
      </div>

      <ol className="grid grid-cols-8 gap-1.5" aria-label="Últimas 8 semanas">
        {seq.semanas.map((s, i) => {
          const mes = s.inicio.slice(5, 7);
          const mudouMes = i === 0 || seq.semanas[i - 1].inicio.slice(5, 7) !== mes;
          const rotulo = s.atual ? "esta" : mudouMes ? MESES[Number(mes) - 1] : "";
          const fim = somarDiasISO(s.inicio, 6);
          return (
            <li key={s.inicio} className="flex flex-col items-center gap-1"
              title={`${s.inicio.slice(8)}/${mes} a ${fim.slice(8)}/${fim.slice(5, 7)}: ${plural(s.total, "post", "posts")}`}>
              <span className={cn(
                "grid h-[30px] w-[30px] place-items-center rounded-full border-2 text-[11px] font-body font-extrabold",
                s.atual
                  ? s.batida ? "border-[#2D4A2B] bg-[#2D4A2B] text-white" : "border-dashed border-[#EA4918] text-[#EA4918]"
                  : s.batida ? "border-[#2D4A2B] bg-[#2D4A2B] text-white" : "border-border text-muted-foreground",
              )}>
                {s.batida ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.atual ? `${s.total}/${seq.meta}` : "·"}
              </span>
              <span className="h-3 text-[10px] font-body font-bold leading-3 text-muted-foreground">{rotulo}</span>
            </li>
          );
        })}
      </ol>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-label={`${seq.feitosSemana} de ${seq.meta} posts nesta semana`}>
        <i className="block h-full rounded-full bg-[#EA4918] transition-[width]" style={{ width: `${pct}%` }} />
      </div>

      <p className="rounded-xl bg-[#FFF1EA] dark:bg-orange-500/10 px-3 py-2 text-[13px] font-body text-foreground">{dica}</p>
      <p className="text-[11.5px] font-body text-muted-foreground">Maior sequência: {plural(seq.maior, "semana", "semanas")}</p>
    </section>
  );
}

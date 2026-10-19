import { useNavigate } from "react-router-dom";
import { AlarmClock, ArrowRight, Briefcase, CalendarClock, PenLine, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { hojeBR } from "@/lib/date-br";
import { useFilaDoParceiro, useMinhasAgencias, useSouParceiro, type CardDaFila } from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   MINHAS DEMANDAS NA HOME (Walter, 19/10/2026; mockup aprovado)

   A social mídia que também é parceira (designer, editor...) não tinha nada
   da fila dela na home: as demandas moravam num item lá embaixo do menu e
   "parecia que tinha sumido". Este bloco fica logo abaixo da saudação com os
   números que pedem ação (atrasadas, vence hoje, ajuste pedido) e as três
   peças mais urgentes. Sem nada aberto, encolhe pra uma linha.
   Parceiro puro tem a ParceiroHome, que já é toda sobre a fila.
   ═══════════════════════════════════════════════════════════════════════════ */

const AREA: Record<string, string> = {
  designer: "design",
  editor_video: "edição",
  filmmaker: "captação",
  copy: "copy",
  trafego: "tráfego",
};

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T12:00:00`) - Date.parse(`${de}T12:00:00`)) / 86_400_000);
}

export function BlocoMinhasDemandas() {
  const navigate = useNavigate();
  const { data: souParceiro } = useSouParceiro();
  const { data: fila = [] } = useFilaDoParceiro();
  const { data: agencias = [] } = useMinhasAgencias();
  if (!souParceiro) return null;

  const hoje = hojeBR();
  const atrasada = (c: CardDaFila) => !!c.prazo_producao && c.prazo_producao < hoje;
  const atrasadas = fila.filter(atrasada);
  const venceHoje = fila.filter((c) => c.prazo_producao === hoje);
  const ajustes = fila.filter((c) => c.producao_status === "ajuste");
  const papel = agencias[0]?.meu_papel ?? "";
  const area = AREA[papel];
  const titulo = area ? `Suas demandas de ${area}` : "Suas demandas";
  const abrir = () => navigate("/socialmidia/demandas");

  if (fila.length === 0) {
    const entregues = agencias.reduce((s, a) => s + (a.entregues_30d ?? 0), 0);
    return (
      <button type="button" onClick={abrir}
        className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 px-4 py-3 text-left transition-colors hover:from-violet-100 hover:to-pink-100">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white"><Briefcase className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 text-sm font-body text-foreground">
          <strong>Nenhuma demanda aberta.</strong>{" "}
          <span className="text-muted-foreground">{entregues > 0 ? `Entregues nos últimos 30 dias: ${entregues}.` : "Quando uma agência te mandar trabalho, aparece aqui."}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 text-[13px] font-body font-bold text-violet-700 sm:inline-flex">Minhas demandas <ArrowRight className="h-3.5 w-3.5" /></span>
      </button>
    );
  }

  // As mais urgentes primeiro: urgente marcado, atrasada, hoje, depois por prazo.
  const ordem = (c: CardDaFila) => (c.urgente ? 0 : atrasada(c) ? 1 : c.prazo_producao === hoje ? 2 : 3);
  const topo = [...fila]
    .sort((a, b) => ordem(a) - ordem(b) || (a.prazo_producao ?? "9999").localeCompare(b.prazo_producao ?? "9999"))
    .slice(0, 3);
  const resto = fila.length - topo.length;

  const numeros = [
    { n: atrasadas.length, txt: atrasadas.length === 1 ? "atrasada" : "atrasadas", Icon: AlarmClock, tom: "vermelho" as const },
    { n: venceHoje.length, txt: "vence hoje", Icon: CalendarClock, tom: "ambar" as const },
    { n: ajustes.length, txt: ajustes.length === 1 ? "ajuste pedido" : "ajustes pedidos", Icon: RotateCcw, tom: "neutro" as const },
    { n: fila.length, txt: "abertas no total", Icon: PenLine, tom: "neutro" as const },
  ];

  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl border-[1.5px] border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50 p-4 sm:p-6">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-violet-200/60" />
      <div className="relative flex flex-wrap items-center gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white"><Briefcase className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-extrabold leading-tight text-foreground">{titulo}</h2>
          <p className="text-[13.5px] font-body text-muted-foreground">
            O que as agências te pediram.
            {atrasadas.length > 0 && <> <span className="font-semibold text-red-700">{atrasadas.length === 1 ? "1 está atrasada." : `${atrasadas.length} estão atrasadas.`}</span></>}
          </p>
        </div>
        <button type="button" onClick={abrir}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 font-display text-sm font-bold text-background transition-opacity hover:opacity-90 sm:w-auto">
          Abrir minhas demandas <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {numeros.map(({ n, txt, Icon, tom }) => (
          <div key={txt} className={cn("rounded-2xl border bg-card px-3.5 py-3",
            tom === "vermelho" && n > 0 ? "border-red-300 bg-red-50" : "border-border")}>
            <p className={cn("font-display text-[28px] font-extrabold leading-none",
              tom === "vermelho" && n > 0 ? "text-red-600" : tom === "ambar" && n > 0 ? "text-amber-700" : "text-foreground")}>{n}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-body text-muted-foreground"><Icon className="h-3.5 w-3.5" />{txt}</p>
          </div>
        ))}
      </div>

      <div className="relative mt-3.5 grid gap-2">
        {topo.map((c) => {
          const late = atrasada(c);
          const dias = late && c.prazo_producao ? diasEntre(c.prazo_producao, hoje) : 0;
          return (
            <button key={c.post_id} type="button" onClick={() => navigate(`/socialmidia/demandas?post=${c.post_id}`)}
              className={cn("flex w-full items-center gap-3 rounded-2xl bg-card px-3 py-2.5 text-left transition-shadow hover:shadow-md",
                late || c.urgente ? "border-2 border-red-300" : "border border-border")}>
              {c.cliente_logo
                ? <img src={c.cliente_logo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" loading="lazy" />
                : <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: c.cliente_cor || "#C4B5FD" }} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-body font-bold text-foreground">{c.titulo || "Peça sem título"}</span>
                <span className="block truncate text-xs font-body text-muted-foreground">{c.cliente_nome} · {c.agencia_nome}</span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-body font-bold",
                late ? "bg-red-600 text-white" : c.prazo_producao === hoje ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground")}>
                {!c.prazo_producao ? "sem prazo"
                  : late ? `atrasada ${dias} ${dias === 1 ? "dia" : "dias"}`
                  : c.prazo_producao === hoje ? "hoje"
                  : `${c.prazo_producao.slice(8, 10)}/${c.prazo_producao.slice(5, 7)}`}
              </span>
            </button>
          );
        })}
      </div>
      {resto > 0 && (
        <button type="button" onClick={abrir} className="relative mt-2.5 text-[13px] font-body font-bold text-violet-700 hover:underline">
          + {resto} {resto === 1 ? "demanda" : "demandas"} na fila
        </button>
      )}
    </section>
  );
}

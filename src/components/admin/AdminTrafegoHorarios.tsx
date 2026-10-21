import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { CalendarClock, Lightbulb, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   DIAS E HORÁRIOS DE MAIS FLUXO (21/10/2026)

   Walter: "mapearmos também os horários de mais fluxo e os dias de mais
   fluxo pra sabermos direcionar melhor as campanhas".

   Grade dia da semana x hora (fuso de São Paulo), via RPC
   admin_trafego_horarios. Quatro leituras da mesma grade: visitas na LP,
   cliques em testar, cadastros e taxa de conversão (cliques / visitas).

   Volume e conversão contam histórias diferentes: o anúncio só entrega quando
   a Meta decide, então a grade de visitas vindas da Meta mostra parte quando
   a Meta entregou, não só quando o público está on-line. Pra decidir horário,
   o que vale é a TAXA de conversão por faixa, com amostra mínima. Por isso as
   leituras abaixo só apontam faixa com 20 visitas ou mais.
   ═══════════════════════════════════════════════════════════════════════════ */

type Celula = { dow: number; hora: number; visitas: number; converteram: number; cadastros: number; tempo_mediano: number | null };
type Horarios = {
  periodo: { ini: string; fim: string; dias: number };
  origem: string;
  grade: Celula[];
  ocorrencias: Record<string, number>;
  bio_por_dia: Record<string, number>;
};
type Metrica = "visitas" | "converteram" | "cadastros" | "taxa";

const sbRpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

// Semana começando na segunda, que é como se planeja campanha. dow 0 = domingo.
const DIAS = [
  { dow: 1, curto: "Seg", nome: "segunda" }, { dow: 2, curto: "Ter", nome: "terça" }, { dow: 3, curto: "Qua", nome: "quarta" },
  { dow: 4, curto: "Qui", nome: "quinta" }, { dow: 5, curto: "Sex", nome: "sexta" }, { dow: 6, curto: "Sáb", nome: "sábado" },
  { dow: 0, curto: "Dom", nome: "domingo" },
];
const nomeDia = (dow: number) => DIAS.find((d) => d.dow === dow)?.nome ?? "";
const FAIXAS = [
  { ini: 0, fim: 6, nome: "madrugada (0h a 6h)" }, { ini: 6, fim: 9, nome: "começo da manhã (6h a 9h)" },
  { ini: 9, fim: 12, nome: "manhã (9h a 12h)" }, { ini: 12, fim: 14, nome: "almoço (12h a 14h)" },
  { ini: 14, fim: 18, nome: "tarde (14h a 18h)" }, { ini: 18, fim: 21, nome: "começo da noite (18h a 21h)" },
  { ini: 21, fim: 24, nome: "noite (21h a 0h)" },
];
const MIN_AMOSTRA = 20;

const n = (v: number) => v.toLocaleString("pt-BR");
const pc = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-full px-3 py-1.5 text-xs font-body font-semibold border transition-colors whitespace-nowrap",
        ativo ? "border-primary/50 bg-primary/[0.08] text-primary" : "border-border hover:bg-muted")}>
      {children}
    </button>
  );
}

function valorCelula(c: Celula, m: Metrica) {
  if (m === "taxa") return c.visitas >= 3 ? c.converteram / c.visitas : null;
  return c[m];
}

export function AdminTrafegoHorarios() {
  const [dias, setDias] = useState(30);
  const [origem, setOrigem] = useState<"todas" | "meta" | "organico">("todas");
  const [metrica, setMetrica] = useState<Metrica>("visitas");

  const { data, isLoading, error } = useQuery<Horarios>({
    queryKey: ["admin-trafego-horarios", dias, origem],
    queryFn: async () => {
      const { data, error } = await sbRpc("admin_trafego_horarios", { _dias: dias, _origem: origem });
      if (error) throw new Error(error.message);
      return data as Horarios;
    },
    staleTime: 5 * 60 * 1000,
  });

  const calc = useMemo(() => {
    if (!data) return null;
    const g = data.grade;
    const cel = (dow: number, hora: number) => g.find((c) => c.dow === dow && c.hora === hora)!;
    const tot = g.reduce((s, c) => ({ visitas: s.visitas + c.visitas, converteram: s.converteram + c.converteram, cadastros: s.cadastros + c.cadastros }),
      { visitas: 0, converteram: 0, cadastros: 0 });
    // Por dia da semana: MÉDIA por ocorrência do dia no período (um período
    // de 30 dias tem 5 quartas e 4 sábados; somar daria vantagem falsa).
    const porDia = DIAS.map((d) => {
      const occ = data.ocorrencias[String(d.dow)] || 1;
      const linha = g.filter((c) => c.dow === d.dow);
      const visitas = linha.reduce((s, c) => s + c.visitas, 0);
      const converteram = linha.reduce((s, c) => s + c.converteram, 0);
      const cadastros = linha.reduce((s, c) => s + c.cadastros, 0);
      return { dia: d.curto, dow: d.dow, visitas, converteram, cadastros,
        media_visitas: +(visitas / occ).toFixed(1), media_cadastros: +(cadastros / occ).toFixed(1),
        bio: +((data.bio_por_dia[String(d.dow)] ?? 0) / occ).toFixed(1) };
    });
    const porHora = Array.from({ length: 24 }, (_, h) => {
      const col = g.filter((c) => c.hora === h);
      return { hora: `${h}h`, h, visitas: col.reduce((s, c) => s + c.visitas, 0), converteram: col.reduce((s, c) => s + c.converteram, 0), cadastros: col.reduce((s, c) => s + c.cadastros, 0) };
    });
    const porFaixa = FAIXAS.map((f) => {
      const col = porHora.filter((x) => x.h >= f.ini && x.h < f.fim);
      return { ...f, visitas: col.reduce((s, c) => s + c.visitas, 0), converteram: col.reduce((s, c) => s + c.converteram, 0), cadastros: col.reduce((s, c) => s + c.cadastros, 0) };
    });
    const vals = g.map((c) => valorCelula(c, metrica)).filter((v): v is number => v != null);
    const max = Math.max(0.0001, ...vals);
    return { cel, tot, porDia, porHora, porFaixa, max };
  }, [data, metrica]);

  const leituras = useMemo(() => {
    if (!calc) return [];
    const out: string[] = [];
    const { tot, porDia, porFaixa } = calc;
    if (tot.visitas === 0 && tot.cadastros === 0) return out;
    const topDia = [...porDia].sort((a, b) => b.media_visitas - a.media_visitas)[0];
    const fundoDia = [...porDia].sort((a, b) => a.media_visitas - b.media_visitas)[0];
    if (topDia.media_visitas > 0) out.push(`Dia com mais visita: ${nomeDia(topDia.dow)} (média de ${n(topDia.media_visitas)} por ${nomeDia(topDia.dow)}). O mais fraco: ${nomeDia(fundoDia.dow)} (${n(fundoDia.media_visitas)}).`);
    const topFaixa = [...porFaixa].sort((a, b) => b.visitas - a.visitas)[0];
    if (topFaixa.visitas > 0) out.push(`Faixa com mais visita: ${topFaixa.nome}, ${pc(topFaixa.visitas, tot.visitas)} de todas.`);
    const comAmostra = porFaixa.filter((f) => f.visitas >= MIN_AMOSTRA);
    if (comAmostra.length >= 2) {
      const ordem = [...comAmostra].sort((a, b) => b.converteram / b.visitas - a.converteram / a.visitas);
      const m = ordem[0], p = ordem[ordem.length - 1];
      out.push(`Quem chega de ${m.nome.split(" (")[0]} converte ${pc(m.converteram, m.visitas)}; de ${p.nome.split(" (")[0]}, ${pc(p.converteram, p.visitas)}. Essa diferença é a que importa pra decidir horário.`);
    } else {
      out.push(`Ainda sem faixa com ${MIN_AMOSTRA} visitas ou mais: dá pra ver onde tem volume, mas não qual horário converte melhor.`);
    }
    const topCad = [...porFaixa].sort((a, b) => b.cadastros - a.cadastros)[0];
    if (topCad.cadastros >= 3) out.push(`Cadastros acontecem mais na faixa ${topCad.nome} (${n(topCad.cadastros)} de ${n(tot.cadastros)}).`);
    return out;
  }, [calc]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex gap-1.5">{[30, 60, 90].map((d) => <Chip key={d} ativo={dias === d} onClick={() => setDias(d)}>{d} dias</Chip>)}</div>
        <div className="flex gap-1.5">
          <Chip ativo={origem === "todas"} onClick={() => setOrigem("todas")}>Todas as origens</Chip>
          <Chip ativo={origem === "meta"} onClick={() => setOrigem("meta")}>Anúncio Meta</Chip>
          <Chip ativo={origem === "organico"} onClick={() => setOrigem("organico")}>Orgânico</Chip>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground font-body py-10 text-center">Carregando…</p>
      ) : error || !data || !calc ? (
        <div className="rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive font-body">
          Não consegui carregar. {(error as Error)?.message}
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-display font-bold text-foreground"><CalendarClock className="h-4 w-4 text-primary" />Mapa da semana</h3>
              <div className="flex gap-1.5 overflow-x-auto">
                <Chip ativo={metrica === "visitas"} onClick={() => setMetrica("visitas")}>Visitas</Chip>
                <Chip ativo={metrica === "converteram"} onClick={() => setMetrica("converteram")}>Clicaram em testar</Chip>
                <Chip ativo={metrica === "cadastros"} onClick={() => setMetrica("cadastros")}>Cadastros</Chip>
                <Chip ativo={metrica === "taxa"} onClick={() => setMetrica("taxa")}>Taxa de conversão</Chip>
              </div>
            </div>
            <p className="text-xs font-body text-muted-foreground mt-1">
              Horário de Brasília. {n(calc.tot.visitas)} visitas, {n(calc.tot.converteram)} cliques em testar e {n(calc.tot.cadastros)} cadastros no período.
              {metrica === "taxa" && " Célula com menos de 3 visitas fica vazia."}
            </p>

            <div className="overflow-x-auto mt-3 -mx-1 px-1">
              <div className="min-w-[640px]">
                <div className="grid gap-[3px]" style={{ gridTemplateColumns: "2.5rem repeat(24, minmax(0, 1fr))" }}>
                  <span />
                  {Array.from({ length: 24 }, (_, h) => (
                    <span key={h} className="text-[10px] font-body text-muted-foreground text-center">{h % 3 === 0 ? `${h}h` : ""}</span>
                  ))}
                  {DIAS.map((d) => (
                    <div key={d.dow} className="contents">
                      <span className="text-[11px] font-body text-muted-foreground self-center">{d.curto}</span>
                      {Array.from({ length: 24 }, (_, h) => {
                        const c = calc.cel(d.dow, h);
                        const v = valorCelula(c, metrica);
                        const i = v == null ? 0 : v / calc.max;
                        return (
                          <div key={h}
                            title={`${d.nome}, ${h}h às ${h + 1}h: ${n(c.visitas)} visitas, ${n(c.converteram)} clicaram em testar (${pc(c.converteram, c.visitas)}), ${n(c.cadastros)} cadastros`}
                            className="aspect-square rounded-[4px]"
                            style={{ background: v == null || v === 0 ? "hsl(var(--muted))" : `rgba(206, 74, 29, ${0.15 + 0.85 * i})` }} />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {leituras.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <h3 className="flex items-center gap-2 text-sm font-display font-bold text-foreground"><Lightbulb className="h-4 w-4 text-primary" />O que a grade diz</h3>
              <ul className="mt-2 space-y-1.5 text-[13px] font-body text-foreground list-disc pl-5">
                {leituras.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </section>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <h3 className="text-sm font-display font-bold text-foreground">Por dia da semana</h3>
              <p className="text-xs font-body text-muted-foreground mt-0.5">Média por dia (cada dia da semana aparece um número diferente de vezes no período)</p>
              <div className="h-56 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={calc.porDia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="media_visitas" name="Visitas na LP" fill="#CE4A1D" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="bio" name="Visitas na bio" fill="#3E9152" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="media_cadastros" name="Cadastros" fill="#2A4BDF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <h3 className="text-sm font-display font-bold text-foreground">Por hora do dia</h3>
              <p className="text-xs font-body text-muted-foreground mt-0.5">Soma do período</p>
              <div className="h-56 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={calc.porHora} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} interval={2} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="visitas" name="Visitas" fill="#CE4A1D" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="converteram" name="Clicaram em testar" fill="#3E9152" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-border bg-muted/40 p-4 text-[12.5px] font-body text-muted-foreground flex gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Antes de cortar horário na Meta: a programação por horário só existe em conjunto com <b>orçamento total</b> (não diário), e cortar
              horário com pouca verba alonga a fase de aprendizado. Com o volume de hoje, use esta grade primeiro pra horário de post, stories e
              lives, e pra escolher dia de subir criativo novo. Programar o anúncio por horário vale quando a taxa de conversão por faixa
              (com {MIN_AMOSTRA}+ visitas cada) mostrar diferença grande e estável por 2 ou 3 semanas.
            </span>
          </section>
        </>
      )}
    </div>
  );
}

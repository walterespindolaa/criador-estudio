import { useMemo } from "react";
import { Camera, Clock, MapPin, ArrowRight, ChevronRight, CalendarPlus, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prontidaoDa, estadoDaPasta, DEGRAUS, type Prontidao, type CapturaMin, type RoteiroMin, type AprovacaoMin, type CapturaPainel, type PastaPainel } from "@/lib/captacao-prontidao";

/* ═══════════════════════════════════════════════════════════════════════════
   O PAINEL DE VOO DO CRIA CAPTAÇÃO (v4, ciclo 2 · 23/09/2026)

   A tela inicial do módulo era organizada por OBJETO: pastas de um lado, agenda
   do outro. A social mídia não pensa em objetos, pensa em tempo, e em cada
   momento faz uma pergunta diferente:

     "o que vem?"          → a próxima gravação, com a escada de prontidão
     "o que falta?"        → a lista de ação, ordenada pelo que vence antes
     "quem eu não marquei?" → cliente ativo sem gravação no mês, com o hábito
                              dele já sugerido ("costuma dia 10")

   Este componente responde as três. Desde 24/09 a grade de clientes mora
   aqui dentro (um card por cliente com a falta e o botão), e o calendário
   fica na página, logo abaixo. Ele não busca nada: recebe as listas prontas e calcula. É o mesmo
   `prontidaoDa` do ciclo 1, então o que o card diz e o que a lista diz nunca
   discordam.
   ═══════════════════════════════════════════════════════════════════════════ */

export type HabitoPainel = { day: number | null; time: string | null };

type Falta = {
  chave: string;
  quando: string | null;      // ISO date ou null (não marcada)
  ordem: number;              // pra ordenar: dias até a data; não marcada vai pro fim
  quem: string;
  cor: string | null;
  texto: string;              // o que fazer
  detalhe: string | null;
  tom: Prontidao["tom"];
  acao: () => void;
  rotuloAcao: string;
};

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function ddmm(iso: string) { const [, m, d] = iso.split("-"); return `${d}/${m}`; }
function diaSemana(iso: string) { return WD[new Date(`${iso}T00:00:00`).getDay()]; }
function diasAte(iso: string, hoje: string) {
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${hoje}T00:00:00`).getTime()) / 86400000);
}
function quando(iso: string, hoje: string) {
  const d = diasAte(iso, hoje);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d > 1 && d < 7) return `${diaSemana(iso)}, em ${d} dias`;
  if (d >= 7) return `em ${d} dias`;
  if (d === -1) return "ontem";
  return `há ${Math.abs(d)} dias`;
}

export function PainelDeVoo({
  caps, scripts, envios, pastas, habitos, hoje, mesEhAtualOuFuturo, nomeDe, corDe,
  onAbrirDia, onAbrirPasta, onMarcar, onNovoAvulso,
}: {
  caps: CapturaPainel[];
  scripts: RoteiroMin[];
  envios: AprovacaoMin[];
  pastas: (PastaPainel & { cidade?: string | null; extraId?: string | null })[];
  onNovoAvulso?: () => void;
  habitos: Map<string, HabitoPainel>;
  hoje: string;
  /** Sugerir "não marcada" só faz sentido pra mês que ainda dá pra marcar. */
  mesEhAtualOuFuturo: boolean;
  nomeDe: (c: CapturaPainel) => string;
  corDe: (c: CapturaPainel) => string | null;
  onAbrirDia: (date: string) => void;
  onAbrirPasta: (key: string) => void;
  onMarcar: (crmId: string, diaSugerido: number | null) => void;
}) {
  // A próxima gravação: a primeira agendada de hoje em diante.
  const proxima = useMemo(
    () => [...caps]
      .filter((c) => c.status === "agendada" && c.capture_date >= hoje)
      .sort((a, b) => a.capture_date.localeCompare(b.capture_date) || (a.capture_time ?? "99").localeCompare(b.capture_time ?? "99"))[0] ?? null,
    [caps, hoje],
  );
  const pProxima = proxima ? prontidaoDa(proxima, scripts, envios) : null;

  /* A LISTA "FALTA PRA FICAR PRONTO". Três fontes, uma lista:
     1. Gravações do mês cujo tom pede ação dela (sem roteiro, sem enviar,
        gravada sem virar post). As que só esperam o cliente entram no fim,
        em cinza: ela não faz nada, mas precisa saber que está esperando.
     2. Clientes da carteira sem gravação no mês, com o hábito como sugestão.
     Ordena pelo que vence antes: hoje e amanhã em cima, o passado (gravadas
     sem virar post) depois do futuro próximo, não marcadas por último. */
  const faltas = useMemo<Falta[]>(() => {
    const out: Falta[] = [];
    for (const c of caps) {
      if (c.status === "cancelada") continue;
      const p = prontidaoDa(c, scripts, envios);
      if (!p.proximoPasso) continue;
      const d = diasAte(c.capture_date, hoje);
      out.push({
        chave: `cap:${c.id}`,
        quando: c.capture_date,
        // Futuro: 0..N. Passado (gravada sem virar post): 100 + dias atrás,
        // pra vir depois do futuro próximo mas antes das não marcadas.
        ordem: d >= 0 ? d : 100 + Math.abs(d),
        quem: nomeDe(c),
        cor: corDe(c),
        texto: p.proximoPasso,
        detalhe: p.detalhe,
        tom: p.tom,
        acao: () => onAbrirDia(c.capture_date),
        rotuloAcao: "Abrir o dia",
      });
    }
    if (mesEhAtualOuFuturo) {
      for (const pa of pastas) {
        if (!pa.crmId || pa.caps.total > 0) continue;
        const h = habitos.get(pa.crmId);
        const crmId = pa.crmId;
        out.push({
          chave: `pasta:${pa.key}`,
          quando: null,
          ordem: 1000,
          quem: pa.nome,
          cor: pa.cor,
          texto: "Marcar gravação",
          detalhe: h?.day ? `costuma gravar dia ${h.day}${h.time ? ` às ${h.time}` : ""}` : "nenhuma gravação neste mês",
          tom: "atencao",
          acao: () => onMarcar(crmId, h?.day ?? null),
          rotuloAcao: h?.day ? `Marcar dia ${h.day}` : "Marcar",
        });
      }
    }
    // Esperando o cliente vai pro fim do seu grupo: ela não age, só acompanha.
    return out.sort((a, b) => (a.tom === "espera" ? 1 : 0) - (b.tom === "espera" ? 1 : 0) || a.ordem - b.ordem);
  }, [caps, scripts, envios, pastas, habitos, hoje, mesEhAtualOuFuturo, nomeDe, corDe, onAbrirDia, onMarcar]);

  const pendentes = faltas.filter((f) => f.tom !== "espera").length;

  /* UM CARD POR CLIENTE (Walter, 24/09/2026: "deixar só os quadrados, sem
     lista e depois os nomes de novo, fica repetitivo"). A lista "Falta pra
     ficar pronto" e a grade de pastas mostravam os mesmos clientes duas
     vezes. Agora cada falta vai morar dentro do card do cliente dela, com o
     botão da ação ali dentro, e a grade vem ordenada pela mesma regra da
     lista antiga: o que vence antes fica em cima. */
  const chaveDaCaptura = useMemo(() => {
    const porNome = new Map<string, string>();
    for (const pa of pastas) if (!pa.crmId) porNome.set(pa.nome.trim().toLowerCase(), pa.key);
    return (c: CapturaPainel) => c.crm_client_id
      ? `crm:${c.crm_client_id}`
      : porNome.get((c.client_name ?? "").trim().toLowerCase()) ?? null;
  }, [pastas]);

  const faltasPorPasta = useMemo(() => {
    const m = new Map<string, Falta[]>();
    for (const f of faltas) {
      let key: string | null = null;
      if (f.chave.startsWith("pasta:")) key = f.chave.slice(6);
      else {
        const cap = caps.find((c) => `cap:${c.id}` === f.chave);
        key = cap ? chaveDaCaptura(cap) : null;
      }
      if (!key) continue;
      m.set(key, [...(m.get(key) ?? []), f]); // já vem ordenado por urgência
    }
    return m;
  }, [faltas, caps, chaveDaCaptura]);

  const pastasOrdenadas = useMemo(() => {
    const peso = (key: string) => {
      const f = faltasPorPasta.get(key)?.[0];
      if (!f) return 10000;
      return (f.tom === "espera" ? 5000 : 0) + f.ordem;
    };
    return pastas.map((p, i) => ({ p, i })).sort((a, b) => peso(a.p.key) - peso(b.p.key) || a.i - b.i).map((x) => x.p);
  }, [pastas, faltasPorPasta]);

  return (
    <div className="space-y-3">
      {/* ── O QUE VEM ── */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        {proxima && pProxima ? (
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white text-base font-display font-extrabold"
                style={{ background: corDe(proxima) || "#EA4918" }}>
                {nomeDe(proxima).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-body font-bold uppercase tracking-wider text-muted-foreground">
                  Próxima gravação · {quando(proxima.capture_date, hoje)}
                </p>
                <p className="text-lg sm:text-xl font-display font-extrabold text-foreground leading-tight truncate">
                  {nomeDe(proxima)}
                </p>
                <div className="mt-1 flex items-center gap-3 flex-wrap text-xs font-body text-muted-foreground">
                  <span>{ddmm(proxima.capture_date)} ({diaSemana(proxima.capture_date)})</span>
                  {proxima.capture_time && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {proxima.capture_time.slice(0, 5)}</span>}
                  {proxima.location?.trim() && <span className="inline-flex items-center gap-1 min-w-0"><MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{proxima.location.trim()}</span></span>}
                </div>
                <Escada p={pProxima} />
              </div>
            </div>
            <div className="flex sm:flex-col gap-2 shrink-0">
              <Button onClick={() => onAbrirDia(proxima.capture_date)} className="rounded-xl flex-1 sm:flex-none">
                <Camera className="h-4 w-4 mr-1.5" /> Abrir o dia
              </Button>
              {proxima.crm_client_id && (
                <Button variant="outline" onClick={() => onAbrirPasta(`crm:${proxima.crm_client_id}`)} className="rounded-xl flex-1 sm:flex-none">
                  Pasta <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground"><Camera className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-display font-extrabold text-foreground">Nenhuma gravação marcada daqui pra frente</p>
              <p className="text-xs font-body text-muted-foreground mt-0.5">
                {faltas.some((f) => f.quando === null)
                  ? "Tem cliente na carteira sem gravação neste mês. Os cards abaixo mostram quem."
                  : "Marque uma gravação pra ela aparecer aqui com o que falta pra ficar pronta."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── OS CLIENTES, cada um com o que falta dentro ── */}
      <div data-tour="cap-pastas">
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <p className="text-sm font-display font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Clientes do mês
          </p>
          <span className={cn("text-[12px] font-body font-bold px-2 py-0.5 rounded-full",
            pendentes === 0 ? "bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))]" : "bg-[hsl(var(--cria-amarelo)/0.15)] text-[hsl(var(--cria-amarelo))]")}>
            {pendentes === 0 ? "tudo em dia" : `${pendentes} ${pendentes === 1 ? "pendência" : "pendências"}`}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {pastasOrdenadas.map((pa) => {
            const fs = faltasPorPasta.get(pa.key) ?? [];
            const f = fs[0] ?? null;
            const outras = fs.length - 1;
            const estado = f ? null : estadoDaPasta(pa, caps, scripts, envios, hoje);
            return (
              <div key={pa.key} role="button" tabIndex={0}
                onClick={() => onAbrirPasta(pa.key)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrirPasta(pa.key); } }}
                className={cn("flex flex-col rounded-2xl border bg-card p-3.5 text-left cursor-pointer hover:shadow-warm-sm transition-all",
                  f && f.tom === "atencao" ? "border-[hsl(var(--cria-amarelo)/0.45)] hover:border-[hsl(var(--cria-amarelo))]" : "border-border hover:border-primary/40")}>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white text-xs font-display font-extrabold"
                    style={{ background: pa.cor || "#EA4918" }}>
                    {pa.nome.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-display font-bold text-foreground truncate">{pa.nome}</p>
                    <p className="text-[12px] font-body text-muted-foreground truncate">
                      {f?.quando
                        ? `${ddmm(f.quando)} · ${quando(f.quando, hoje)}`
                        : estado ? estado.texto : (pa.cidade || (pa.extraId ? "avulso" : "sem gravação no mês"))}
                    </p>
                  </div>
                </div>

                {f ? (
                  <>
                    <p className={cn("mt-2.5 text-[12.5px] font-body leading-snug",
                      f.tom === "atencao" ? "text-[hsl(var(--cria-amarelo))] font-semibold" : "text-muted-foreground")}>
                      {f.texto}{f.detalhe ? ` · ${f.detalhe}` : ""}
                    </p>
                    {outras > 0 && (
                      <p className="text-[12px] font-body text-muted-foreground mt-0.5">
                        + {outras} {outras === 1 ? "outra gravação pendente" : "outras gravações pendentes"}
                      </p>
                    )}
                    <div className="mt-auto pt-3">
                      <Button size="sm" variant={f.tom === "atencao" ? "default" : "outline"}
                        onClick={(e) => { e.stopPropagation(); f.acao(); }}
                        className="w-full h-9 rounded-xl text-[12.5px]">
                        {f.quando === null ? <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> : <Camera className="h-3.5 w-3.5 mr-1.5" />}
                        {f.rotuloAcao}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className={cn("mt-2.5 text-[12.5px] font-body font-semibold",
                    estado?.p?.tom === "ok" ? "text-[hsl(var(--cria-verde))]" : "text-muted-foreground")}>
                    {estado?.p ? "Nada pendente" : "Sem gravação neste mês"}
                    <ChevronRight className="inline h-3.5 w-3.5 ml-0.5 -mt-0.5" />
                  </p>
                )}
              </div>
            );
          })}
          {onNovoAvulso && (
            <button type="button" onClick={onNovoAvulso}
              className="rounded-2xl border border-dashed border-border p-3.5 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors grid place-items-center min-h-[96px]">
              <span className="inline-flex flex-col items-center gap-1 text-xs font-body font-semibold">
                <UserPlus className="h-5 w-5" /> Cliente avulso
              </span>
            </button>
          )}
        </div>
        <p className="text-[12px] font-body text-muted-foreground mt-2 px-1">
          Toque no card pra abrir a pasta do cliente (roteiros, captações e tomadas). O botão faz a próxima ação.
        </p>
      </div>
    </div>
  );
}

/* A escada de cinco degraus, a mesma da ficha do cliente. Vive aqui e não no
   SeloProntidao porque precisa de largura: em lista fica o selo. */
export function Escada({ p }: { p: Prontidao }) {
  if (p.degrau === "cancelada") return null;
  return (
    <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
      {DEGRAUS.map((d, i) => {
        const nivel = i + 1;
        const subido = p.nivel >= nivel;
        const atual = p.nivel === nivel;
        return (
          <span key={d.degrau} className="inline-flex items-center gap-1.5">
            <span className={cn(
              "text-[11px] font-body font-semibold px-2 py-0.5 rounded-full border",
              atual
                ? (p.tom === "atencao"
                  ? "border-[hsl(var(--cria-amarelo))] bg-[hsl(var(--cria-amarelo))] text-white"
                  : p.tom === "espera"
                    ? "border-muted-foreground/40 bg-muted text-foreground"
                    : "border-[hsl(var(--cria-verde))] bg-[hsl(var(--cria-verde))] text-white")
                : subido
                  ? "border-[hsl(var(--cria-verde)/0.35)] bg-[hsl(var(--cria-verde)/0.10)] text-[hsl(var(--cria-verde))]"
                  : "border-border text-muted-foreground/60",
            )}>
              {d.rotulo}
            </span>
            {i < DEGRAUS.length - 1 && <span className={cn("h-px w-3", p.nivel > nivel ? "bg-[hsl(var(--cria-verde)/0.5)]" : "bg-border")} />}
          </span>
        );
      })}
      {p.proximoPasso && p.tom === "atencao" && (
        <span className="text-[12px] font-body font-semibold text-[hsl(var(--cria-amarelo))] ml-1">
          agora: {p.proximoPasso.toLowerCase()}
        </span>
      )}
    </div>
  );
}
